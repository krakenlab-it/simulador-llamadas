import type { ConversationTurn } from "@/lib/agent/client-motor";
import type { BuyerPsychState } from "@/lib/agent/buyer-psych";
import { SESSION_MAX_TURN_ALLOCATIONS } from "@/lib/voice/brakes";

/** Trainee + client pairs kept in the model chat window for long calls. */
export const LIVE_DIALOGUE_PAIR_LIMIT = 8;

export function resolveLiveSessionMaxTurns(
  configuredPhaseCount: number,
  turnNumber: number,
): number {
  const base = Math.max(configuredPhaseCount || 5, SESSION_MAX_TURN_ALLOCATIONS);
  return Math.max(base, turnNumber);
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
    "Transcript reciente (memoria de la llamada; no repitas líneas ya dichas):",
    ...windowed,
  ].join("\n");
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

function normalizeForCompare(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * When the model or clone-guard would repeat, pick a phase-appropriate line
 * that is not identical to recent client replies or the primary fallback.
 */
export function pickNonRepeatingFallback(input: {
  phase: BuyerPsychState["phase"];
  recentReplies: readonly string[];
  primaryFallback: string;
  turnNumber: number;
}): string {
  const banned = new Set(
    [...input.recentReplies, input.primaryFallback].map(normalizeForCompare),
  );
  const pool = FALLBACK_VARIANTS[input.phase];
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(input.turnNumber + offset) % pool.length];
    if (!banned.has(normalizeForCompare(candidate))) {
      return candidate;
    }
  }
  return input.primaryFallback;
}
