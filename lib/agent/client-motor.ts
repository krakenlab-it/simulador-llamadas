import type { DifficultyLevel } from "@/lib/db/types";
import {
  utteranceHasConcreteDayAndTime,
  utteranceHasDay,
  utteranceHasTime,
} from "@/lib/scoring/keywords";
import { mapDifficultyToJaime } from "./client-layer";

export interface EmotionalMeters {
  confianza: number;
  interes: number;
  paciencia: number;
}

export interface MeetingLogisticsState {
  meetingAccepted: boolean;
  presentationAccepted: boolean;
  dayTimeMentioned: boolean;
  sellerAskingContact: boolean;
  /** Presentation/meeting already granted and a concrete slot is on the table. */
  shouldAcknowledgeSlot: boolean;
}

export interface ConversationTurn {
  role: "trainee" | "client";
  text: string;
}

export interface ClientLiveState {
  mode: "cliente" | "evaluador";
  meters: EmotionalMeters;
  turnNumber: number;
  meetingAccepted: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function initialEmotionalMeters(
  difficultyLevel: DifficultyLevel,
): EmotionalMeters {
  const level = mapDifficultyToJaime(difficultyLevel);
  switch (level) {
    case 1:
      return { confianza: 4, interes: 5, paciencia: 8 };
    case 2:
      return { confianza: 3, interes: 4, paciencia: 7 };
    case 3:
      return { confianza: 3, interes: 3, paciencia: 6 };
    case 4:
    case 5:
      return { confianza: 2, interes: 2, paciencia: 5 };
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

const CLIENT_ACCEPTANCE =
  /\b(?:va|sale|listo|de acuerdo|perfecto|agendado|quedamos|nos vemos|le espero|está bien|me parece|suena bien|me late|adelante|ok|pueden presentar|puede presentar|sí pueden|si pueden)\b|acepto|agendemos/i;
const NEXT_STEP_CONTEXT =
  /\b(?:cita|reuni[oó]n|videollamada|llamada|demo|junta|agenda|calendario|invitaci[oó]n|presentaci[oó]n|presentar|revisi[oó]n|revisar|tablero|mesa|piloto|siguiente paso)\b/i;
const SELLER_CONTACT =
  /\b(?:correo|e-?mail|whatsapp|whats\s*app|calendario|invitaci[oó]n)\b/i;
const SHORT_AFFIRMATION = /\b(?:va|listo|de acuerdo|perfecto|adelante)\b/i;

export const DATE_DEMAND_AFTER_ACCEPT =
  /sin fecha|no hay reun[ió]n|no hay revisi[oó]n|fecha en (?:la )?agenda|sin d[ií]a y hora|d[ií]a y hora concret|qu[eé] d[ií]a|a qu[eé] hora|primero d[ií]game qu[eé] d[ií]a|en mi agenda no hay/i;

export const SLOT_ACK_LINES = [
  "Ese horario me sirve. Traiga el tablero de caseta, no un pitch.",
  "Queda. Envíeme la invitación y vemos la revisión de caseta.",
  "De acuerdo, ese día y hora. Siguiente: logística del tablero.",
] as const;

function transcriptText(turns: readonly ConversationTurn[]): string {
  return turns.map((turn) => turn.text).join("\n");
}

function clientLines(turns: readonly ConversationTurn[]): string[] {
  return turns.filter((turn) => turn.role === "client").map((turn) => turn.text);
}

export function mentionsDayAndTime(text: string): boolean {
  return (
    utteranceHasConcreteDayAndTime(text) ||
    (utteranceHasDay(text) && utteranceHasTime(text))
  );
}

function traineeOfferedNextStep(turns: readonly ConversationTurn[]): boolean {
  return turns.some(
    (turn) => turn.role === "trainee" && NEXT_STEP_CONTEXT.test(turn.text),
  );
}

export function clientAcceptedMeeting(
  turns: readonly ConversationTurn[],
): boolean {
  const recent = clientLines(turns).slice(-4);
  if (recent.length === 0) return false;
  const sellerOffered = traineeOfferedNextStep(turns);
  return recent.some((line) => {
    if (CLIENT_ACCEPTANCE.test(line) && NEXT_STEP_CONTEXT.test(line)) {
      return true;
    }
    if (!CLIENT_ACCEPTANCE.test(line) && !SHORT_AFFIRMATION.test(line)) {
      return false;
    }
    return NEXT_STEP_CONTEXT.test(line) || sellerOffered;
  });
}

export function analyzeMeetingLogistics(
  turns: readonly ConversationTurn[],
  traineeUtterance: string,
  persistedAccepted = false,
): MeetingLogisticsState {
  const presentationAccepted =
    persistedAccepted || clientAcceptedMeeting(turns);
  const corpus = `${transcriptText(turns)}\n${traineeUtterance}`;
  const dayTimeMentioned = mentionsDayAndTime(corpus);
  const meetingAccepted = presentationAccepted;
  return {
    meetingAccepted,
    presentationAccepted,
    dayTimeMentioned,
    sellerAskingContact: SELLER_CONTACT.test(traineeUtterance),
    shouldAcknowledgeSlot: presentationAccepted && dayTimeMentioned,
  };
}

export function extractOfferedSlot(text: string): string | null {
  const match = text.match(
    /\b((?:el\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+a\s+las?\s+(?:\d{1,2}(?::\d{2})?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce))?(?:\s*(?:am|pm|hrs?))?(?:\s+de\s+la\s+(?:ma[nñ]ana|tarde|noche))?)/i,
  );
  return match?.[1]?.trim() ?? null;
}

export function acknowledgeOfferedSlot(utterance: string, seed = 0): string {
  const slot = extractOfferedSlot(utterance);
  if (slot) {
    return `${slot.charAt(0).toUpperCase()}${slot.slice(1)}. Traiga el tablero de caseta.`;
  }
  const index = Math.abs(seed) % SLOT_ACK_LINES.length;
  return SLOT_ACK_LINES[index];
}

export function repairDateDemandAfterAccept(
  line: string,
  utterance = "",
  seed = 0,
): string | null {
  if (!DATE_DEMAND_AFTER_ACCEPT.test(line)) return null;
  return acknowledgeOfferedSlot(utterance, seed);
}

export function buildLiveStateBlock(input: {
  meters: EmotionalMeters;
  logistics: MeetingLogisticsState;
  turnNumber: number;
  maxTurns: number;
}): string {
  const lines = [
    "ESTADO EN VIVO",
    `Turno: ${input.turnNumber} de ${input.maxTurns}`,
    `Confianza: ${input.meters.confianza.toFixed(1)} · Interés: ${input.meters.interes.toFixed(1)} · Paciencia: ${input.meters.paciencia.toFixed(1)}`,
    `Cita aceptada: ${input.logistics.meetingAccepted ? "sí" : "no"}`,
    `Presentación aceptada: ${input.logistics.presentationAccepted ? "sí" : "no"}`,
    `Día y hora mencionados: ${input.logistics.dayTimeMentioned ? "sí" : "no"}`,
  ];
  if (input.logistics.shouldAcknowledgeSlot) {
    lines.push(
      "El vendedor ya ofreció un horario concreto después de que aceptaste la presentación. Confirma ESE día y hora y pasa a logística (tablero de caseta / invitación). Nunca digas ni parafrasees «sin día y hora… caseta».",
    );
  } else if (input.logistics.meetingAccepted) {
    lines.push(
      "El siguiente paso ya existe. No pidas otra vez la fecha ni digas «sin fecha no hay reunión».",
    );
  }
  if (input.logistics.meetingAccepted && input.logistics.sellerAskingContact) {
    lines.push(
      "El vendedor pide correo o WhatsApp para la invitación: colabora sin inventar datos.",
    );
  }
  return lines.join("\n");
}

export function updateEmotionalMeters(
  current: EmotionalMeters,
  utterance: string,
  temperament: string,
  turnNumber: number,
): EmotionalMeters {
  let { confianza, interes, paciencia } = current;
  const words = utterance.trim().split(/\s+/).filter(Boolean).length;
  const lower = utterance.toLowerCase();

  if (words >= 12 && /soy |me llamo|le llamo/i.test(utterance)) confianza += 1;
  if (/permiso|interrumpo|un minuto|tiene tiempo/i.test(lower)) paciencia += 1;
  if (/\?/.test(utterance) && words < 40) interes += 1;
  if (/entiendo|lo que me dice|entonces usted/i.test(lower)) confianza += 1.5;
  if (words > 60 && !/\?/.test(utterance)) paciencia -= 2;
  if (/líderes|soluciones integrales|somos la mejor/i.test(lower)) interes -= 1;
  if (/última oportunidad|solo hoy|ahorita o nunca/i.test(lower)) confianza -= 2;

  const next = {
    confianza: clamp(confianza),
    interes: clamp(interes),
    paciencia: clamp(paciencia),
  };
  const busy = /ocupad|impacient|prisa|entre juntas/i.test(temperament);
  if (busy && turnNumber > 0 && turnNumber % 3 === 0) {
    next.paciencia = clamp(next.paciencia - 1);
  }
  return next;
}
