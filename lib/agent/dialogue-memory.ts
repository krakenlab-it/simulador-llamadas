import type { BuyerPhase, BuyerPsychState } from "@/lib/agent/buyer-psych";
import type {
  ConversationTurn,
  MeetingLogisticsState,
} from "@/lib/agent/client-motor";

/**
 * Long-call harness (dialogue-state tracking, not a bigger model).
 *
 * Working memory is a short verbatim tail in the chat messages.
 * Older turns collapse into a structured state summary.
 * The same lines are not pasted again into the system prompt — that echo
 * is what makes the buyer repeat itself.
 * Every cliente line is checked on the way out: closed beats stay closed,
 * and a repeat is replaced with a line that itself passes the check.
 */

/** Verbatim trainee/client pairs kept as chat messages. */
export const LIVE_DIALOGUE_PAIR_LIMIT = 4;

/** Last N cliente lines called out as forbidden echoes in the prompt. */
export const CLIENT_ANTI_ECHO_COUNT = 4;

/** Character-trigram overlap that counts as a paraphrase of a recent line. */
const TRIGRAME_ECHO_THRESHOLD = 0.55;

/** Content-word overlap that counts as a paraphrase of a recent line. */
const CONTENT_ECHO_THRESHOLD = 0.62;

const ES_STOPWORDS = new Set([
  "para",
  "como",
  "este",
  "esta",
  "esto",
  "pero",
  "porque",
  "cuando",
  "donde",
  "con",
  "sin",
  "por",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "que",
  "muy",
  "mas",
  "sus",
  "ella",
  "ellos",
  "ellas",
  "usted",
  "ustedes",
]);

const IDENTITY_REOPEN =
  /\b(?:qui[eé]n habla|de d[oó]nde llaman|qui[eé]n les dio|a qui[eé]n busco)\b/i;
const REASON_REOPEN =
  /\b(?:para qu[eé] (?:es|llaman|me llaman)|por qu[eé] (?:llaman|me llaman)|de qu[eé] se trata)\b/i;
const SLOT_AMNESIA = /sin d[ií]a y hora/i;

const PROGRESS_LINES = [
  "Mire, eso ya quedó. Vamos a lo que sigue.",
  "No lo repito. Dígame el siguiente paso concreto.",
  "Ya le respondí eso. ¿Qué necesita cerrar ahora?",
  "Seguimos adelante. No vuelvo a esa parte.",
] as const;

export function normalizeUtterance(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function contentTokens(text: string): string[] {
  return normalizeUtterance(text)
    .split(" ")
    .filter((word) => word.length > 2 && !ES_STOPWORDS.has(word));
}

function charTrigrams(text: string): Set<string> {
  const compact = normalizeUtterance(text).replace(/ /g, "");
  const grams = new Set<string>();
  if (compact.length < 3) return grams;
  for (let index = 0; index <= compact.length - 3; index += 1) {
    grams.add(compact.slice(index, index + 3));
  }
  return grams;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isParaphraseEcho(candidate: string, prior: string): boolean {
  const left = normalizeUtterance(candidate);
  const right = normalizeUtterance(prior);
  if (left.length < 20 || right.length < 20) return false;
  if (jaccard(charTrigrams(left), charTrigrams(right)) >= TRIGRAME_ECHO_THRESHOLD) {
    return true;
  }
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (leftTokens.length < 4 || rightTokens.length < 4) return false;
  return jaccard(new Set(leftTokens), new Set(rightTokens)) >= CONTENT_ECHO_THRESHOLD;
}

/**
 * Hard no-repeat.
 * Exact copies are banned against the whole call.
 * Paraphrases are banned against the last N cliente lines (anti-echo window),
 * so a short shared word early in the call does not block a later turn.
 */
export function isHardRepeatViolation(
  candidate: string,
  recentClientReplies: readonly string[],
): boolean {
  const normalized = normalizeUtterance(candidate);
  if (!normalized) return true;
  if (/^(ok|okay|si|vale|claro|entendido)$/.test(normalized)) return true;

  for (const prior of recentClientReplies) {
    const other = normalizeUtterance(prior);
    if (!other) continue;
    if (other === normalized) return true;
    if (other.length > 18 && (normalized.includes(other) || other.includes(normalized))) {
      return true;
    }
  }

  const echoWindow = recentClientReplies.slice(-CLIENT_ANTI_ECHO_COUNT);
  return echoWindow.some((prior) => isParaphraseEcho(candidate, prior));
}

/** True when the draft re-opens a beat the call has already left. */
export function reopensClosedBeat(
  candidate: string,
  psych: BuyerPsychState,
): boolean {
  if (
    psych.identitySettled &&
    psych.phase !== "opening_id" &&
    IDENTITY_REOPEN.test(candidate)
  ) {
    return true;
  }
  if (
    psych.reasonHeard &&
    (psych.phase === "negotiate" ||
      psych.phase === "schedule_or_exit" ||
      psych.phase === "closing") &&
    REASON_REOPEN.test(candidate)
  ) {
    return true;
  }
  if (psych.slotOffered && SLOT_AMNESIA.test(candidate)) return true;
  return false;
}

export function mergeClientReplies(
  priorTurns: readonly ConversationTurn[],
  recentReplies: readonly string[] = [],
): string[] {
  const lines = priorTurns
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.text.trim())
    .filter(Boolean);

  for (const extra of recentReplies) {
    const trimmed = extra.trim();
    if (!trimmed) continue;
    const normalized = normalizeUtterance(trimmed);
    const already = lines.some((line) => normalizeUtterance(line) === normalized);
    if (!already) lines.push(trimmed);
  }
  return lines;
}

export function buildClientAntiEchoBlock(
  recentClientReplies: readonly string[],
): string {
  const window = recentClientReplies.slice(-CLIENT_ANTI_ECHO_COUNT);
  if (window.length === 0) return "";
  return [
    `ANTI-ECO (prohibido repetir o parafrasear estas ${window.length} réplicas del cliente):`,
    ...window.map((line, index) => `${index + 1}. ${line.trim()}`),
  ].join("\n");
}

function nextLegalMove(phase: BuyerPhase): string {
  switch (phase) {
    case "opening_id":
      return "Ahora: una pregunta corta de quién llama. Solo si aún no se presentaron.";
    case "reason_probe":
      return "Ahora: una duda breve del motivo. No reinicies la presentación.";
    case "resist":
      return "Ahora: un block o un stall nuevo. No repitas la objeción anterior.";
    case "negotiate":
      return "Ahora: respuesta parcial o condición. No vuelvas a quién llama ni al pitch inicial.";
    case "schedule_or_exit":
      return "Ahora: acepta, contraoferta o salida sobre el horario que ya está en mesa.";
    case "closing":
      return "Ahora: confirma lo acordado o despídete. Sin pregunta nueva y sin reabrir la apertura.";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

/** Beats already settled — buyer must not re-litigate early phases on long calls. */
export function buildPhaseAdvanceHarnessBlock(
  psych: BuyerPsychState,
  logistics: MeetingLogisticsState,
): string {
  const closed: string[] = [];

  if (psych.identitySettled && psych.phase !== "opening_id") {
    closed.push("Apertura / quién llama: CERRADA.");
  }
  if (
    psych.reasonHeard &&
    psych.phase !== "opening_id" &&
    psych.phase !== "reason_probe"
  ) {
    closed.push("Motivo de la llamada: YA ESCUCHADO.");
  }
  if (
    psych.phase === "negotiate" ||
    psych.phase === "schedule_or_exit" ||
    psych.phase === "closing"
  ) {
    closed.push("Objeción inicial: YA EXPRESADA.");
  }
  if (logistics.presentationAccepted) {
    closed.push("Presentación / siguiente paso: ACEPTADO.");
  }
  if (psych.slotOffered) {
    closed.push(
      `Slot en mesa${psych.offeredSlot ? `: ${psych.offeredSlot}` : ""}. No digas que no hubo horario.`,
    );
  }
  if (psych.slotResolved || psych.phase === "closing") {
    closed.push("Cierre en curso.");
  }

  return [
    "AVANCE DE FASE (no re-litigar beats viejos):",
    ...closed.map((line) => `- ${line}`),
    nextLegalMove(psych.phase),
  ].join("\n");
}

function clip(text: string, max = 96): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Rolling state summary. Older turns become facts; the verbatim tail lives
 * only in the chat messages so the model does not see the same lines twice.
 */
export function buildRollingContextSummary(input: {
  priorTurns: readonly ConversationTurn[];
  psych: BuyerPsychState;
  logistics: MeetingLogisticsState;
  roundNumber: number;
}): string {
  const traineeLines = input.priorTurns
    .filter((turn) => turn.role === "trainee")
    .map((turn) => turn.text.trim())
    .filter(Boolean);
  const clientLines = input.priorTurns
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.text.trim())
    .filter(Boolean);
  const covered = traineeLines.slice(0, -1).slice(-3).map((line) => clip(line, 72));
  const facts = [
    input.psych.identitySettled ? "Identidad: ya dicha" : "Identidad: pendiente",
    input.psych.reasonHeard ? "Motivo: ya escuchado" : "Motivo: pendiente",
    input.logistics.presentationAccepted
      ? "Siguiente paso: concedido"
      : "Siguiente paso: no concedido",
    input.psych.slotOffered
      ? `Horario: ${input.psych.offeredSlot ?? "ofrecido"}`
      : "Horario: no ofrecido",
    input.psych.slotResolved ? "Cita: resuelta" : null,
  ].filter(Boolean);

  return [
    "RESUMEN RODANTE (estado de la llamada, no es un transcript para copiar)",
    `Turno ${input.roundNumber} · fase: ${input.psych.phase} · resistencia: ${input.psych.resistanceStyle}`,
    facts.join(" · "),
    covered.length ? `Ya cubrió el vendedor: ${covered.join(" · ")}` : "",
    clientLines.at(-1) ? `Tu última postura: ${clip(clientLines.at(-1) ?? "")}` : "",
    traineeLines.at(-1)
      ? `Último movimiento del vendedor: ${clip(traineeLines.at(-1) ?? "")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBuyerHarnessContextBlocks(input: {
  priorTurns: readonly ConversationTurn[];
  recentClientReplies: readonly string[];
  psych: BuyerPsychState;
  logistics: MeetingLogisticsState;
  roundNumber: number;
}): string {
  return [
    buildRollingContextSummary({
      priorTurns: input.priorTurns,
      psych: input.psych,
      logistics: input.logistics,
      roundNumber: input.roundNumber,
    }),
    buildPhaseAdvanceHarnessBlock(input.psych, input.logistics),
    buildClientAntiEchoBlock(input.recentClientReplies),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildImpersonationChatMessages(input: {
  priorTurns: readonly ConversationTurn[];
  traineeUtterance: string;
}): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of input.priorTurns) {
    if (turn.role === "trainee") {
      messages.push({
        role: "user",
        content: `El vendedor dijo: "${turn.text.trim()}"`,
      });
    } else {
      messages.push({ role: "assistant", content: turn.text.trim() });
    }
  }

  messages.push({
    role: "user",
    content: `El vendedor dijo: "${input.traineeUtterance.trim()}"`,
  });

  return messages.slice(-LIVE_DIALOGUE_PAIR_LIMIT * 2);
}

const FALLBACK_VARIANTS: Record<BuyerPhase, readonly string[]> = {
  opening_id: [
    "Este… ¿quién habla? Estoy en el local.",
    "¿De dónde me llaman? Estoy ocupada.",
    "Dígame, ¿a quién busco?",
  ],
  reason_probe: [
    "Mmm, ¿y esto para qué es?",
    "Estoy entre juntas. Sea breve.",
    "A ver, ¿qué necesitan de mí?",
  ],
  resist: [
    "Ya tenemos proveedor. No busco otra cosa.",
    "Mira, ahora no me convence.",
    "No tengo banda para otro pitch.",
  ],
  negotiate: [
    "Puede ser, pero no regalo la agenda.",
    "Suena interesante; aún no me cierra.",
    "Déjeme pensarlo con mi equipo.",
  ],
  schedule_or_exit: [
    "Si hay día y hora concretos, lo vemos.",
    "Mándeme opciones y lo reviso.",
    "Ese horario podría funcionar; confírmeme por escrito.",
  ],
  closing: [
    "Gracias. Quedamos así.",
    "Listo, nos vemos entonces.",
    "Perfecto. Hasta luego.",
  ],
};

function lineIsBlocked(
  candidate: string,
  psych: BuyerPsychState,
  recentReplies: readonly string[],
): boolean {
  return (
    isHardRepeatViolation(candidate, recentReplies) ||
    reopensClosedBeat(candidate, psych)
  );
}

export function pickNonRepeatingFallback(input: {
  psych: BuyerPsychState;
  recentReplies: readonly string[];
  primaryFallback: string;
  turnNumber: number;
}): string {
  if (!lineIsBlocked(input.primaryFallback, input.psych, input.recentReplies)) {
    return input.primaryFallback;
  }
  const pool = [
    ...FALLBACK_VARIANTS[input.psych.phase],
    ...PROGRESS_LINES,
  ];
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(input.turnNumber + offset) % pool.length];
    if (!lineIsBlocked(candidate, input.psych, input.recentReplies)) {
      return candidate;
    }
  }
  const unique = `Seguimos en esta llamada, turno ${input.turnNumber}.`;
  if (!lineIsBlocked(unique, input.psych, input.recentReplies)) return unique;
  return input.primaryFallback;
}

/** Final harness guard before a cliente line is stored or spoken. */
export function enforceHarnessNoRepeat(input: {
  candidate: string;
  recentClientReplies: readonly string[];
  psych: BuyerPsychState;
  primaryFallback: string;
  turnNumber: number;
}): string {
  const trimmed = input.candidate.trim();
  if (!lineIsBlocked(trimmed, input.psych, input.recentClientReplies)) {
    return trimmed;
  }
  return pickNonRepeatingFallback({
    psych: input.psych,
    recentReplies: input.recentClientReplies,
    primaryFallback: input.primaryFallback,
    turnNumber: input.turnNumber,
  });
}
