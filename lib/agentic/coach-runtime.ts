import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import type { CoachNoteInput } from "./types";

export function buildCoachNotePrompt(input: CoachNoteInput): string {
  return `Eres un coach de ventas observando la simulación. NUNCA hables como el cliente.
Ronda: ${input.roundLabel}.
Producto: ${input.pack.product}.
Criterio de éxito: ${input.pack.winCriteria}.
Analítica del turno: ${input.analyticsSummary}.
El vendedor dijo: "${input.traineeUtterance}".
Escribe UNA nota breve (máx. 2 oraciones) para el vendedor: qué mejorar en la siguiente réplica.
No uses comillas ni roleplay de cliente.`;
}

export function templateCoachNote(input: CoachNoteInput): string {
  return `${input.roundLabel}: mantén el foco en ${input.pack.winCriteria.toLowerCase()} sin inventar datos del cliente.`;
}

export async function generateCoachNote(input: CoachNoteInput): Promise<string> {
  const fallback = templateCoachNote(input);
  if (!isLlmAvailable()) return fallback;

  const prompt = buildCoachNotePrompt(input);
  const note = await callLlm(prompt, { maxTokens: 80, temperature: 0.4 });
  if (!note || note.length < 10 || note.length > 280) return fallback;

  const lower = note.toLowerCase();
  if (lower.includes("soy ") && lower.includes("cliente")) {
    return fallback;
  }

  return note;
}
