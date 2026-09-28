import type { MeetingLogisticsState } from "@/lib/agent/client-motor";
import type { ConversationTurn } from "@/lib/agent/client-motor";
import type { BuyerPsychState } from "@/lib/agent/buyer-psych";

/** Verbatim trainee + client pairs in the rolling window. */
export const LIVE_DIALOGUE_PAIR_LIMIT = 8;

/** Last N cliente lines used for anti-echo and hard no-repeat. */
export const CLIENT_ANTI_ECHO_COUNT = 4;

/** Token overlap at or above this vs a recent cliente line counts as a repeat. */
const HARD_REPEAT_JACCARD_THRESHOLD = 0.72;

export function normalizeUtterance(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeUtterance(text)
      .split(" ")
      .filter((word) => word.length > 2),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Hard no-repeat: exact match, near-duplicate substring, or high token overlap
 * against any of the last N cliente turns.
 */
export function isHardRepeatViolation(
  candidate: string,
  recentClientReplies: readonly string[],
): boolean {
  const normalized = normalizeUtterance(candidate);
  if (!normalized) return true;
  if (/^(ok|okay|s[ií]|vale|claro|entendido)$/.test(normalized)) return true;

  const window = recentClientReplies.slice(-CLIENT_ANTI_ECHO_COUNT);
  return window.some((prior) => {
    const other = normalizeUtterance(prior);
    if (!other) return false;
    if (other === normalized) return true;
    if (other.length > 12 && normalized.includes(other)) return true;
    if (normalized.length > 12 && other.includes(normalized)) return true;
    return jaccardSimilarity(candidate, prior) >= HARD_REPEAT_JACCARD_THRESHOLD;
  });
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

/** Beats already settled — buyer must not re-litigate early phases on long calls. */
export function buildPhaseAdvanceHarnessBlock(
  psych: BuyerPsychState,
  logistics: MeetingLogisticsState,
): string {
  const closed: string[] = [];

  if (psych.identitySettled || psych.phase !== "opening_id") {
    closed.push(
      "Apertura / quién llama: CERRADA — no vuelvas a «¿quién habla?» salvo interrupción nueva.",
    );
  }
  if (psych.reasonHeard || ["resist", "negotiate", "schedule_or_exit", "closing"].includes(psych.phase)) {
    closed.push(
      "Motivo de la llamada: YA ESCUCHADO — no pidas otra vez «para qué llaman».",
    );
  }
  if (
    psych.phase === "negotiate" ||
    psych.phase === "schedule_or_exit" ||
    psych.phase === "closing"
  ) {
    closed.push(
      "Objeción inicial: YA EXPRESADA — avanza a agenda, contraoferta o salida.",
    );
  }
  if (logistics.presentationAccepted) {
    closed.push(
      "Presentación / siguiente paso: ACEPTADO — no reabras el pitch desde cero.",
    );
  }
  if (psych.slotOffered) {
    closed.push(
      `Slot en mesa${psych.offeredSlot ? `: ${psych.offeredSlot}` : ""} — latch activo, no amnesia.`,
    );
  }
  if (psych.slotResolved || psych.phase === "closing") {
    closed.push("Cierre en curso — confirmación o despedida, sin entrevista nueva.");
  }

  if (closed.length === 0) return "";
  return ["AVANCE DE FASE (no re-litigar beats viejos):", ...closed.map((line) => `- ${line}`)].join(
    "\n",
  );
}

function summarizeOlderTurns(turns: readonly ConversationTurn[]): string {
  const cutoff = Math.max(0, turns.length - LIVE_DIALOGUE_PAIR_LIMIT * 2);
  const older = turns.slice(0, cutoff);
  if (older.length === 0) return "";

  const themes = older
    .filter((turn) => turn.role === "trainee")
    .map((turn) => turn.text.trim().slice(0, 72))
    .filter(Boolean)
    .slice(-3);

  if (themes.length === 0) return "";
  return `Antes en la llamada el vendedor mencionó: ${themes.join(" · ")}`;
}

export function buildDialogueTranscriptBlock(
  priorTurns: readonly ConversationTurn[],
  maxPairs = LIVE_DIALOGUE_PAIR_LIMIT,
): string {
  const lines: string[] = [];
  for (const turn of priorTurns) {
    const prefix = turn.role === "trainee" ? "Vendedor" : "Cliente";
    lines.push(`${prefix}: ${turn.text.trim()}`);
  }
  if (lines.length === 0) return "";
  const windowed = lines.slice(-maxPairs * 2);
  return [
    "Ventana reciente (verbatim):",
    ...windowed,
  ].join("\n");
}

/**
 * Rolling harness context: compact summary of call state + older themes + recent verbatim window.
 */
export function buildRollingContextSummary(input: {
  priorTurns: readonly ConversationTurn[];
  psych: BuyerPsychState;
  logistics: MeetingLogisticsState;
  roundNumber: number;
}): string {
  const headline = [
    "RESUMEN RODANTE",
    `Turno ${input.roundNumber} · fase comprador: ${input.psych.phase}`,
    `Resistencia: ${input.psych.resistanceStyle}`,
    input.logistics.meetingAccepted ? "Reunión/presentación: concedida" : null,
    input.logistics.dayTimeMentioned ? "Día y hora: en mesa" : null,
    input.psych.offeredSlot ? `Slot recordado: ${input.psych.offeredSlot}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const older = summarizeOlderTurns(input.priorTurns);
  const recent = buildDialogueTranscriptBlock(input.priorTurns);

  return [headline, older, recent].filter(Boolean).join("\n\n");
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

  const maxMessages = LIVE_DIALOGUE_PAIR_LIMIT * 2;
  return messages.slice(-maxMessages);
}

const FALLBACK_VARIANTS: Record<
  BuyerPsychState["phase"],
  readonly string[]
> = {
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

export function pickNonRepeatingFallback(input: {
  phase: BuyerPsychState["phase"];
  recentReplies: readonly string[];
  primaryFallback: string;
  turnNumber: number;
}): string {
  const banned = new Set(
    [...input.recentReplies, input.primaryFallback].map(normalizeUtterance),
  );
  const pool = FALLBACK_VARIANTS[input.phase];
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(input.turnNumber + offset) % pool.length];
    if (!banned.has(normalizeUtterance(candidate))) {
      return candidate;
    }
  }
  return input.primaryFallback;
}

/** Final harness guard before returning a cliente line to the session. */
export function enforceHarnessNoRepeat(input: {
  candidate: string;
  recentClientReplies: readonly string[];
  phase: BuyerPsychState["phase"];
  primaryFallback: string;
  turnNumber: number;
}): string {
  const trimmed = input.candidate.trim();
  if (!trimmed || isHardRepeatViolation(trimmed, input.recentClientReplies)) {
    return pickNonRepeatingFallback({
      phase: input.phase,
      recentReplies: input.recentClientReplies,
      primaryFallback: input.primaryFallback,
      turnNumber: input.turnNumber,
    });
  }
  return trimmed;
}
