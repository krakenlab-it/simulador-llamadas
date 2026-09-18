import { alignmentNotes, composeSeparatedSystemPrompt } from "./roles";
import type { AgentHarnessSettings, AgentToolId } from "./types";

export function buildToolInstructions(enabledTools: AgentToolId[]): string {
  return [
    "Herramientas habilitadas:",
    enabledTools.join(", "),
    "Cuando el caso esté listo, propose_scenario. Para un ajuste, patch_draft. Para confirmar, apply_scenario.",
    "Para equipos: list_teams. Para el mismo examen: compare_team_test.",
  ].join("\n");
}

export function resolveEditableSystemPrompt(
  settings: AgentHarnessSettings,
): string {
  return settings.systemPrompt.trim();
}

export function composeRuntimeSystemPrompt(input: {
  settings: AgentHarnessSettings;
  contextPack: string;
}): { systemPrompt: string; roles: { agent: string; user: string; context: string } } {
  const agent = [
    resolveEditableSystemPrompt(input.settings),
    "",
    buildToolInstructions(input.settings.enabledTools),
  ].join("\n");
  const user = alignmentNotes(input.settings.language);
  const context = input.contextPack;
  return {
    systemPrompt: composeSeparatedSystemPrompt({ agent, user, context }),
    roles: { agent, user, context },
  };
}
