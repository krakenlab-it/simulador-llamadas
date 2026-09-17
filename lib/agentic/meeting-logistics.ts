import type { ConversationTurn } from "./types";
import { utteranceHasConcreteDayAndTime, utteranceHasDay, utteranceHasTime } from "@/lib/scoring/keywords";

export interface MeetingLogisticsState {
  meetingAccepted: boolean;
  dayTimeMentioned: boolean;
  sellerAskingContact: boolean;
}

const CLIENT_ACCEPTANCE =
  /\b(?:va|sale|listo|de acuerdo|perfecto|agendado|quedamos|nos vemos|le espero|ahí nos vemos|está bien|me parece bien|adelante|ok)\b|acepto|agendemos/i;

const CLIENT_MEETING_CONTEXT =
  /\b(?:cita|reuni[oó]n|videollamada|llamada|demo|junta|agenda|calendario|invitaci[oó]n)\b/i;

const SELLER_CONTACT_ASK =
  /\b(?:correo|e-?mail|whatsapp|whats\s*app|calendario|invitaci[oó]n|mandar(?:le)?\s+la\s+cita|enviar(?:le)?\s+la\s+invitaci[oó]n)\b/i;

export const DATE_DEMAND_AFTER_ACCEPT =
  /sin fecha|no hay reun[ió]n|fecha en (?:la )?agenda|sin d[ií]a y hora|d[ií]a y hora concret|qué d[ií]a|a qué hora|primero d[ií]game qué d[ií]a/i;

export const EMAIL_COLLABORATION_LINES = [
  "sí, mándela al correo de la empresa, ahorita se lo paso por mensaje.",
  "al mismo número de donde le contesto, por favor.",
  "sí, envíela y yo la confirmo con mi asistente.",
] as const;

function transcriptText(turns: readonly ConversationTurn[]): string {
  return turns.map((turn) => turn.text).join("\n");
}

function clientLines(turns: readonly ConversationTurn[]): string[] {
  return turns.filter((turn) => turn.role === "client").map((turn) => turn.text);
}

export function clientAcceptedMeeting(turns: readonly ConversationTurn[]): boolean {
  const lines = clientLines(turns);
  if (lines.length === 0) return false;

  const recent = lines.slice(-4);
  return recent.some((line) => {
    const lower = line.toLowerCase();
    if (!CLIENT_ACCEPTANCE.test(lower)) return false;
    if (CLIENT_MEETING_CONTEXT.test(lower)) return true;
    // Short affirmations after scheduling talk in the thread count as acceptance.
    const thread = transcriptText(turns).toLowerCase();
    return CLIENT_MEETING_CONTEXT.test(thread) && /\b(?:sí|si|va|listo|de acuerdo|perfecto)\b/.test(lower);
  });
}

export function transcriptMentionsDayTime(turns: readonly ConversationTurn[]): boolean {
  const corpus = transcriptText(turns);
  return (
    utteranceHasConcreteDayAndTime(corpus) ||
    (utteranceHasDay(corpus) && utteranceHasTime(corpus))
  );
}

export function sellerAskingForContact(utterance: string): boolean {
  return SELLER_CONTACT_ASK.test(utterance.trim());
}

export function analyzeMeetingLogistics(
  turns: readonly ConversationTurn[],
  traineeUtterance: string,
  persistedAccepted = false,
): MeetingLogisticsState {
  const meetingAccepted = persistedAccepted || clientAcceptedMeeting(turns);
  return {
    meetingAccepted,
    dayTimeMentioned: transcriptMentionsDayTime(turns),
    sellerAskingContact: sellerAskingForContact(traineeUtterance),
  };
}

export function buildMeetingLogisticsLiveBlock(state: MeetingLogisticsState): string {
  const lines = [
    `Cita aceptada por el cliente: ${state.meetingAccepted ? "sí" : "no"}`,
    `Día y hora mencionados en la conversación: ${state.dayTimeMentioned ? "sí" : "no"}`,
  ];

  if (state.meetingAccepted) {
    lines.push(
      "La cita ya fue aceptada. No vuelvas a pedir fecha ni digas ni parafrasees «sin fecha no hay reunión».",
    );
  }

  if (state.meetingAccepted && state.sellerAskingContact) {
    lines.push(
      "El vendedor pide correo, WhatsApp o teléfono para la invitación: colabora con las líneas del pack sin inventar datos.",
    );
  }

  if (!state.meetingAccepted && !state.dayTimeMentioned) {
    lines.push(
      "Si aún no aceptaste y no hay día ni hora, puedes pedir el momento una sola vez antes de aceptar.",
    );
  }

  return lines.join("\n");
}

export function repairDateDemandAfterAccept(
  line: string,
  seed = 0,
): string | null {
  if (!DATE_DEMAND_AFTER_ACCEPT.test(line)) return null;
  const index = Math.abs(seed) % EMAIL_COLLABORATION_LINES.length;
  return EMAIL_COLLABORATION_LINES[index];
}

export function meetingAcceptedFromPriorLines(
  priorLines?: readonly { role: string; text: string }[],
): boolean {
  if (!priorLines?.length) return false;
  const turns: ConversationTurn[] = priorLines.map((line) => ({
    role: line.role === "client" ? "client" : "trainee",
    text: line.text,
  }));
  return clientAcceptedMeeting(turns);
}
