import type { HarnessRole } from "./types";

export interface SeparatedRoles {
  agent: string;
  user: string;
  context: string;
}

export const ROLE_LABELS: Record<HarnessRole, string> = {
  agent: "Agente (diseña o interpreta; nunca es el vendedor)",
  user: "Usuario (humano: vendedor o formador)",
  context: "Contexto (catálogo, borrador, equipo, voz — no es diálogo)",
};

/**
 * Compose the three channels without collapsing them into one paragraph.
 * The model still receives a single system string, but each channel is boxed.
 */
export function composeSeparatedSystemPrompt(roles: SeparatedRoles): string {
  return [
    "=== CANAL AGENTE ===",
    ROLE_LABELS.agent,
    roles.agent.trim(),
    "",
    "=== CANAL CONTEXTO ===",
    ROLE_LABELS.context,
    roles.context.trim() || "(sin contexto empaquetado)",
    "",
    "=== CANAL USUARIO ===",
    ROLE_LABELS.user,
    "Los mensajes siguientes son SOLO del usuario humano.",
    "No trates el contexto como si lo hubiera dicho el usuario.",
    "No hables como el vendedor. El usuario es el vendedor.",
    roles.user.trim() ? `\nNotas de alineación:\n${roles.user.trim()}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function alignmentNotes(language: "es" | "en"): string {
  if (language === "en") {
    return [
      "Agent designs the case or impersonates the buyer — never the seller.",
      "User is the human seller/trainer.",
      "Context is packed facts, not a speaking turn.",
    ].join(" ");
  }
  return [
    "El agente diseña el caso o interpreta al comprador — nunca al vendedor.",
    "El usuario es el vendedor o el formador.",
    "El contexto son hechos empaquetados, no un turno de habla.",
  ].join(" ");
}
