import {
  acknowledgeOfferedSlot,
  analyzeMeetingLogistics,
  DATE_DEMAND_AFTER_ACCEPT,
  extractOfferedSlot,
  type ConversationTurn,
  type MeetingLogisticsState,
} from "@/lib/agent/client-motor";
import type { ClientScenarioPack, DecisionRole } from "@/lib/agent/client-layer";
import {
  getCatalogPreset,
  type BuyerResistanceStyle,
} from "@/lib/scenarios/catalog-presets";
import { utteranceHasConcreteDayAndTime } from "@/lib/scoring/keywords";

export type { BuyerResistanceStyle };

/**
 * Buyer phase on a live phone call (Humă & Stokoe anatomy of B2B cold calls).
 * Forced — the cliente does not free-form forever.
 */
export const BUYER_PHASES = [
  "opening_id",
  "reason_probe",
  "resist",
  "negotiate",
  "schedule_or_exit",
  "closing",
] as const;
export type BuyerPhase = (typeof BUYER_PHASES)[number];

export const BUYER_LIVE_TEMPERATURE = 0.8;
export const BUYER_MAX_OUTPUT_TOKENS = 80;
export const BUYER_DEFAULT_MAX_SENTENCES = 2;
export const BUYER_DEFAULT_TOKEN_BUDGET = 40;
export const BUYER_RANT_TOKEN_BUDGET = 80;

export const ASSISTANT_CLOSING =
  /en qu[eé] m[aá]s (?:te|le) puedo ayudar|aqu[ií] estoy|no dudes en|estoy para ayudarte|con gusto te ayudo|hay algo m[aá]s(?: en lo)? que (?:pueda|puedo)|claro[,!]?\s+aqu[ií]/i;

export const AI_OR_SCENARIO_LEAK =
  /\b(?:soy una? (?:ia|inteligencia)|soy un modelo|esto es (?:un )?(?:entrenamiento|simulaci[oó]n|escenario)|como (?:ia|asistente)|estoy aqu[ií] para ayudarte a (?:vender|practicar))\b/i;

export const STALL_NO_SLOT = /sin d[ií]a y hora/i;

const IDENTITY_ASK =
  /\b(?:qui[eé]n habla|de d[oó]nde llaman|qui[eé]n les dio|a qui[eé]n busco)\b/i;
const TRAINEE_INTRO = /\b(?:soy |me llamo|mi nombre es|le llamo de|llamo de)\b/i;
const REASON_CUES =
  /\b(?:caseta|tablero|visita|cac|tr[aá]fico|piso|showroom|presentaci[oó]n|reuni[oó]n|cita|m²|tickets)\b/i;
const HARD_BLOCK =
  /\b(?:no me interesa|ya tenemos (?:proveedor|agencia)|cuelgo|no busco otra cosa|ahora no puedo)\b/i;
const SLOT_RESOLVE =
  /\b(?:quedamos|agendado|nos vemos|ese horario|me sirve|no puedo (?:ese|ese d[ií]a)|mejor (?:el|el lunes|martes|mi[eé]rcoles|jueves|viernes))\b/i;
const CHANNEL_STALL = /\b(?:m[aá]ndame|correo|whatsapp|whats\s*app|la otra semana)\b/i;
const LONG_PITCH_WORDS = 40;

export interface BuyerPsychState {
  phase: BuyerPhase;
  resistanceStyle: BuyerResistanceStyle;
  decisionRole: DecisionRole;
  subsequentCall: boolean;
  slotOffered: boolean;
  slotResolved: boolean;
  hardBlock: boolean;
  identitySettled: boolean;
  reasonHeard: boolean;
  longPitch: boolean;
  gatekeeper: boolean;
  rantMode: boolean;
  tokenBudget: number;
  maxSentences: number;
  offeredSlot: string | null;
}

export interface BuyerPsychInput {
  traineeUtterance: string;
  priorTurns?: readonly ConversationTurn[];
  roundNumber: number;
  scenarioSlug?: string;
  pack?: Pick<
    ClientScenarioPack,
    "decisionRole" | "encounterType" | "temperament"
  >;
  logistics?: MeetingLogisticsState;
}

export function resistanceStyleForSlug(slug?: string): BuyerResistanceStyle {
  const preset = slug ? getCatalogPreset(slug) : undefined;
  return preset?.resistanceStyle ?? "stall";
}

export function detectSlotOffered(
  turns: readonly ConversationTurn[],
  traineeUtterance: string,
): boolean {
  const traineeLines = [
    ...turns.filter((turn) => turn.role === "trainee").map((turn) => turn.text),
    traineeUtterance,
  ];
  return traineeLines.some((line) => utteranceHasConcreteDayAndTime(line));
}

export function estimateSpokenTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

export function splitSpokenSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function endsWithQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

export function countQuestionTurns(lines: readonly string[]): number {
  return lines.filter((line) => line.includes("?")).length;
}

function clientLines(turns: readonly ConversationTurn[]): string[] {
  return turns.filter((turn) => turn.role === "client").map((turn) => turn.text);
}

function stallRepeatCount(lines: readonly string[]): number {
  return lines.filter((line) => STALL_NO_SLOT.test(line)).length;
}

function sameObjectionStreak(lines: readonly string[]): number {
  if (lines.length < 2) return lines.length;
  const normalized = lines.map((line) =>
    line.trim().toLowerCase().replace(/\s+/g, " "),
  );
  const last = normalized.at(-1);
  if (!last) return 0;
  let streak = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (normalized[index] === last) streak += 1;
    else break;
  }
  return streak;
}

export function resolveBuyerPhase(input: {
  turnNumber: number;
  subsequentCall: boolean;
  identitySettled: boolean;
  reasonHeard: boolean;
  hasResisted: boolean;
  slotOffered: boolean;
  slotResolved: boolean;
  hardBlock: boolean;
  presentationAccepted: boolean;
  longPitch: boolean;
  resistanceStyle: BuyerResistanceStyle;
}): BuyerPhase {
  if (input.slotResolved) return "closing";
  if (input.hardBlock && (input.hasResisted || input.turnNumber >= 2)) {
    return "closing";
  }
  if (
    input.resistanceStyle === "block" &&
    input.turnNumber >= 2 &&
    !input.slotOffered &&
    !input.presentationAccepted
  ) {
    return "closing";
  }
  if (input.slotOffered || input.presentationAccepted) {
    return "schedule_or_exit";
  }
  if (input.longPitch && input.turnNumber >= 2) return "resist";
  if (input.hasResisted && input.reasonHeard && input.turnNumber >= 4) {
    return "negotiate";
  }
  if (input.subsequentCall) return "resist";
  if (input.reasonHeard || input.turnNumber >= 3) return "resist";
  if (input.identitySettled || input.turnNumber >= 2) return "reason_probe";
  return "opening_id";
}

export function analyzeBuyerPsych(input: BuyerPsychInput): BuyerPsychState {
  const turns = input.priorTurns ?? [];
  const logistics =
    input.logistics ?? analyzeMeetingLogistics(turns, input.traineeUtterance);
  const resistanceStyle = resistanceStyleForSlug(input.scenarioSlug);
  const decisionRole = input.pack?.decisionRole ?? "decisor";
  const subsequentCall = input.pack?.encounterType === "seguimiento";
  const slotOffered = detectSlotOffered(turns, input.traineeUtterance);
  const offeredSlot =
    extractOfferedSlot(input.traineeUtterance) ??
    turns
      .filter((turn) => turn.role === "trainee")
      .map((turn) => extractOfferedSlot(turn.text))
      .find((slot): slot is string => Boolean(slot)) ??
    null;
  const recentClient = clientLines(turns);
  const identitySettled =
    recentClient.some((line) => IDENTITY_ASK.test(line)) ||
    TRAINEE_INTRO.test(input.traineeUtterance) ||
    turns.some(
      (turn) => turn.role === "trainee" && TRAINEE_INTRO.test(turn.text),
    );
  const reasonHeard =
    REASON_CUES.test(input.traineeUtterance) ||
    turns.some((turn) => turn.role === "trainee" && REASON_CUES.test(turn.text));
  const hardBlock =
    HARD_BLOCK.test(input.traineeUtterance) ||
    recentClient.some((line) => HARD_BLOCK.test(line));
  const slotResolved =
    recentClient.some((line) => SLOT_RESOLVE.test(line)) && slotOffered;
  const hasResisted =
    recentClient.some(
      (line) =>
        HARD_BLOCK.test(line) ||
        STALL_NO_SLOT.test(line) ||
        CHANNEL_STALL.test(line),
    ) || input.roundNumber >= 2;
  const words = input.traineeUtterance.trim().split(/\s+/).filter(Boolean).length;
  const longPitch =
    words >= LONG_PITCH_WORDS && splitSpokenSentences(input.traineeUtterance).length > 2;
  const gatekeeper =
    decisionRole === "influenciador" || decisionRole === "guardian";
  const rantMode = resistanceStyle === "block" && longPitch;
  const phase = resolveBuyerPhase({
    turnNumber: input.roundNumber,
    subsequentCall,
    identitySettled,
    reasonHeard,
    hasResisted,
    slotOffered,
    slotResolved,
    hardBlock,
    presentationAccepted: logistics.presentationAccepted,
    longPitch,
    resistanceStyle,
  });
  const allowLong = rantMode || (gatekeeper && phase === "resist");
  return {
    phase,
    resistanceStyle,
    decisionRole,
    subsequentCall,
    slotOffered,
    slotResolved,
    hardBlock,
    identitySettled,
    reasonHeard,
    longPitch,
    gatekeeper,
    rantMode,
    tokenBudget: allowLong ? BUYER_RANT_TOKEN_BUDGET : BUYER_DEFAULT_TOKEN_BUDGET,
    maxSentences: allowLong ? 4 : BUYER_DEFAULT_MAX_SENTENCES,
    offeredSlot,
  };
}

function phaseInstruction(phase: BuyerPhase): string {
  switch (phase) {
    case "opening_id":
      return "Fase opening_id: pregunta quién habla o de dónde llaman. Turno corto. No ayudes a vender.";
    case "reason_probe":
      return "Fase reason_probe: una duda de por qué llaman o «estoy ocupada». No interrogues.";
    case "resist":
      return "Fase resist: un block O un stall según tu estilo. No los dos. No resumas el pitch.";
    case "negotiate":
      return "Fase negotiate: respuesta parcial. Protege tu agenda. Aún no regales la cita.";
    case "schedule_or_exit":
      return "Fase schedule_or_exit: si hay día y hora concretos, acepta, contraoferta o block. Nunca «sin día y hora».";
    case "closing":
      return "Fase closing: gracias + salida, o confirma el slot. Sin pregunta nueva.";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

function resistanceInstruction(style: BuyerResistanceStyle): string {
  switch (style) {
    case "block":
      return "Estilo block: empuja a cortar («ahora no puedo», «ya tenemos proveedor»). No debates features cinco turnos.";
    case "stall":
      return "Estilo stall: atrasa una vez (correo, socio, «sin día y hora» SOLO si aún no hay slot). Luego escala o concede.";
    case "curious_guarded":
      return "Estilo curious_guarded: una duda concreta, info parcial, proteges el piso/agenda.";
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

const FEW_SHOT = [
  "FAIL: «¡Claro! ¿En qué más te puedo ayudar para agendar?»",
  "PASS: «Este… ¿quién habla? Estoy en la caseta.»",
  "FAIL: «Te resumo tu pitch y te sugiero pedir el jueves.»",
  "PASS: «Mira, ya tenemos agencia. No busco otra cosa.»",
  "FAIL: «Sin día y hora en mi agenda no hay revisión de caseta.» (después de viernes 9am)",
  "PASS: «Viernes a las 9. Traiga el tablero.»",
  "FAIL: párrafo de 6 renglones con viñetas.",
  "PASS: «Mmm. Mándame un WhatsApp. Estoy en otra cosa.»",
].join("\n");

export function buildBuyerRoleLock(input: {
  name: string;
  title?: string;
  setting?: string;
  hiddenGoals?: string;
  state: BuyerPsychState;
}): string {
  const setting = input.setting ?? "una llamada de ventas no pedida";
  const role = input.title ?? "comprador";
  return [
    `Eres ${input.name}, un ${role} REAL al teléfono en ${setting}. Idioma: español mexicano hablado.`,
    "Eres el CLIENTE en el teléfono, NO un asistente, coach ni IA útil. El otro es un vendedor.",
    "Nunca hables como el vendedor. Nunca des coaching. Solo la réplica del cliente.",
    input.hiddenGoals ? `Metas privadas: ${input.hiddenGoals}` : "",
    resistanceInstruction(input.state.resistanceStyle),
    phaseInstruction(input.state.phase),
    `Tope de turno: ${input.state.maxSentences} oración(es), ~${input.state.tokenBudget} tokens. A menudo terminas SIN pregunta.`,
    "Hesitación ligera OK (este, mmm, mira). Respuestas parciales OK. Protege tu tiempo.",
    input.state.subsequentCall
      ? "Llamada posterior: ya se conocen. NO preguntes quién habla. Ve a resistir o a la agenda."
      : "Llamada en frío: en los primeros turnos puedes pedir quién habla / de dónde llaman.",
    input.state.gatekeeper
      ? "Eres guardian/influenciador: NO agendes solo. Redirige a quien decide o pide correo."
      : "",
    input.state.longPitch
      ? "El vendedor se alargó: corta («espéreme») o salta de tema. No escuches como coach."
      : "",
    input.state.slotOffered
      ? `Latch de slot: el vendedor ya ofreció ${input.state.offeredSlot ?? "un día y hora concretos"}. Acéptalo, contraoferta o block. Prohibido «sin día y hora» como si no hubiera oferta.`
      : "",
    "PROHIBIDO: cierres de asistente; sobre-ayuda; prosa perfecta / párrafos / viñetas; pregunta en cada turno; admitir IA o escenario; bucle de stall tras slot; misma objeción 3+ veces; calidez de porrista.",
    "INYECTA: hesitación oral; un solo hecho; proteger agenda; un block O un stall; a veces turno muy corto; normas sociales; memoria del slot.",
    "Few-shot:",
    FEW_SHOT,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBuyerPsychBlock(state: BuyerPsychState): string {
  return [
    "ESTADO PSIC DEL COMPRADOR",
    `Fase: ${state.phase}`,
    `Resistencia: ${state.resistanceStyle}`,
    `Slot ofrecido: ${state.slotOffered ? "sí" : "no"}`,
    state.offeredSlot ? `Slot en memoria: ${state.offeredSlot}` : "",
    `Gatekeeper: ${state.gatekeeper ? "sí" : "no"}`,
    `Llamada posterior: ${state.subsequentCall ? "sí" : "no"}`,
    `Tope: ${state.maxSentences} oraciones / ~${state.tokenBudget} tokens`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function hasForbiddenBuyerLeak(text: string): boolean {
  return ASSISTANT_CLOSING.test(text) || AI_OR_SCENARIO_LEAK.test(text);
}

export function clipBuyerTurn(text: string, state: BuyerPsychState): string {
  const sentences = splitSpokenSentences(text);
  const clipped = sentences.slice(0, state.maxSentences).join(" ");
  if (estimateSpokenTokens(clipped) <= state.tokenBudget) return clipped;
  const words = clipped.split(/\s+/).filter(Boolean);
  const keep = Math.max(4, Math.floor(state.tokenBudget / 1.3));
  return words.slice(0, keep).join(" ");
}

/**
 * Post-LLM / template guard. Additive to KAN-94: never rewrite a date-demand
 * into a fake slot ack unless a real offered slot was detected.
 */
export function enforceBuyerTurnPolicy(
  reply: string,
  state: BuyerPsychState,
  traineeUtterance: string,
  recentReplies: readonly string[] = [],
): string {
  let text = reply.trim();
  if (!text) return text;

  if (hasForbiddenBuyerLeak(text)) {
    text = state.phase === "opening_id"
      ? "Este… ¿quién habla? Estoy ocupada."
      : "Mira, ahora no puedo con eso.";
  }

  if (STALL_NO_SLOT.test(text) && state.slotOffered) {
    const slot = extractOfferedSlot(traineeUtterance) ?? state.offeredSlot;
    if (slot) {
      return acknowledgeOfferedSlot(traineeUtterance || slot);
    }
  }

  if (DATE_DEMAND_AFTER_ACCEPT.test(text) && state.slotOffered) {
    const slot = extractOfferedSlot(traineeUtterance) ?? state.offeredSlot;
    if (slot) {
      return acknowledgeOfferedSlot(traineeUtterance || slot);
    }
  }

  if (state.phase === "closing" && endsWithQuestion(text)) {
    text = text.replace(/\?\s*$/, ".").trim();
  }

  if (
    endsWithQuestion(text) &&
    countQuestionTurns(recentReplies.slice(-3)) >= 2 &&
    state.phase !== "opening_id" &&
    state.phase !== "reason_probe"
  ) {
    text = text.replace(/\?\s*$/, ".").trim();
  }

  if (sameObjectionStreak([...recentReplies, text]) >= 3) {
    text =
      state.resistanceStyle === "block"
        ? "Ya les dije que no. Cuelgo."
        : "Mándame un WhatsApp. No voy a repetir lo mismo.";
  }

  if (stallRepeatCount([...recentReplies, text]) >= 4 && !state.slotOffered) {
    text = "Mira, mándame correo. Así no seguimos en círculo.";
  }

  if (state.gatekeeper && /\b(?:quedamos|agendado|nos vemos el)\b/i.test(text)) {
    text = "Eso no lo firmo yo. Pásame un correo y se lo veo al que decide.";
  }

  return clipBuyerTurn(text, state);
}

export function evaluateBuyerBehavior(input: {
  replies: readonly string[];
  state: BuyerPsychState;
  scene: "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";
}): { pass: boolean; reason: string } {
  const replies = input.replies.map((line) => line.trim()).filter(Boolean);
  const joined = replies.join(" ");
  switch (input.scene) {
    case "E1": {
      const askedId = replies.slice(0, 2).some((line) => IDENTITY_ASK.test(line));
      const leak = replies.some((line) => hasForbiddenBuyerLeak(line));
      const long = replies.some(
        (line) => estimateSpokenTokens(line) > BUYER_RANT_TOKEN_BUDGET,
      );
      if (askedId && !leak && !long) return { pass: true, reason: "cold open" };
      return { pass: false, reason: leak ? "assistant closing" : "no identity ask" };
    }
    case "E2": {
      const stalls = stallRepeatCount(replies);
      if (stalls === 1 && !input.state.slotOffered) {
        return { pass: true, reason: "stall once" };
      }
      return { pass: false, reason: `stall count ${stalls}` };
    }
    case "E3": {
      const leaked = replies.some((line) => STALL_NO_SLOT.test(line));
      const remembered = Boolean(
        input.state.offeredSlot &&
          replies.some((line) =>
            line.toLowerCase().includes(input.state.offeredSlot!.toLowerCase()),
          ),
      );
      if (input.state.slotOffered && !leaked && remembered) {
        return { pass: true, reason: "slot latch" };
      }
      return { pass: false, reason: leaked ? "sin día y hora loop" : "no slot memory" };
    }
    case "E4": {
      if (input.state.phase === "closing" && HARD_BLOCK.test(joined)) {
        return { pass: true, reason: "hard block to close" };
      }
      return { pass: false, reason: `phase ${input.state.phase}` };
    }
    case "E5": {
      const polite = /gracias/i.test(joined);
      const extraQ = replies.at(-1) ? endsWithQuestion(replies.at(-1)!) : false;
      if (polite && !extraQ && input.state.phase === "closing") {
        return { pass: true, reason: "polite exit" };
      }
      return { pass: false, reason: "kept interviewing" };
    }
    case "E6": {
      const bookedAlone = /\b(?:quedamos|agendado|nos vemos el)\b/i.test(joined);
      const redirected = /correo|director|dueño|quien decide|el que decide/i.test(
        joined,
      );
      if (input.state.gatekeeper && !bookedAlone && redirected) {
        return { pass: true, reason: "gatekeeper redirect" };
      }
      return { pass: false, reason: bookedAlone ? "booked alone" : "no redirect" };
    }
    case "E7": {
      const cutIn = /esp[eé]reme|a ver|mira[,.]|quién les dio/i.test(joined);
      if (input.state.longPitch && cutIn && !hasForbiddenBuyerLeak(joined)) {
        return { pass: true, reason: "interrupt" };
      }
      return { pass: false, reason: "waited like a coach" };
    }
    case "E8": {
      const coldId = IDENTITY_ASK.test(joined);
      if (input.state.subsequentCall && !coldId && input.state.phase !== "opening_id") {
        return { pass: true, reason: "warm subsequent" };
      }
      return { pass: false, reason: "acted first-time cold" };
    }
    default: {
      const _exhaustive: never = input.scene;
      return _exhaustive;
    }
  }
}
