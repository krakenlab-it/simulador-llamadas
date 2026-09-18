import type { DifficultyLevel } from "@/lib/db/types";
import { mapDifficultyToJaime } from "./client-layer";

export interface EmotionalMeters {
  confianza: number;
  interes: number;
  paciencia: number;
}

export interface MeetingLogisticsState {
  meetingAccepted: boolean;
  dayTimeMentioned: boolean;
  sellerAskingContact: boolean;
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
  /\b(?:va|sale|listo|de acuerdo|perfecto|agendado|quedamos|nos vemos|le espero|está bien|adelante|ok)\b|acepto|agendemos/i;
const EXPLICIT_MEETING_ACCEPTANCE =
  /\b(?:agendado|quedamos|nos vemos|le espero|agendemos)\b|acepto/i;
const MEETING_CONTEXT =
  /\b(?:cita|reuni[oó]n|videollamada|llamada|demo|junta|agenda|calendario|invitaci[oó]n)\b/i;
const SELLER_CONTACT =
  /\b(?:correo|e-?mail|whatsapp|whats\s*app|calendario|invitaci[oó]n)\b/i;
const DAY_TIME =
  /\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[nñ]ana|tarde|jueves|lunes)\b.*\b(?:\d{1,2}|diez|once|doce|ocho|nueve)\b|\b(?:\d{1,2}:\d{2}|a las \d{1,2})\b/i;

function clientLines(turns: readonly ConversationTurn[]): string[] {
  return turns.filter((turn) => turn.role === "client").map((turn) => turn.text);
}

export function clientAcceptedMeeting(
  turns: readonly ConversationTurn[],
): boolean {
  const recent = clientLines(turns).slice(-4);
  if (recent.length === 0) return false;
  return recent.some((line) => {
    if (EXPLICIT_MEETING_ACCEPTANCE.test(line)) return true;
    if (!CLIENT_ACCEPTANCE.test(line)) return false;
    return MEETING_CONTEXT.test(line);
  });
}

export function analyzeMeetingLogistics(
  turns: readonly ConversationTurn[],
  traineeUtterance: string,
  persistedAccepted = false,
): MeetingLogisticsState {
  const corpus = `${turns.map((turn) => turn.text).join("\n")}\n${traineeUtterance}`;
  return {
    meetingAccepted: persistedAccepted || clientAcceptedMeeting(turns),
    dayTimeMentioned: DAY_TIME.test(corpus),
    sellerAskingContact: SELLER_CONTACT.test(traineeUtterance),
  };
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
    `Día y hora mencionados: ${input.logistics.dayTimeMentioned ? "sí" : "no"}`,
  ];
  if (input.logistics.meetingAccepted) {
    lines.push(
      "La cita ya existe. No pidas otra vez la fecha ni digas «sin fecha no hay reunión».",
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
