import { defaultPromptForPreset } from "./presets";
import type { AgentHarnessSettings } from "./types";

export function resolveEditableSystemPrompt(
  settings: AgentHarnessSettings,
): string {
  if (settings.systemPrompt.trim()) return settings.systemPrompt;
  return defaultPromptForPreset(
    settings.presetId === "custom" ? "coach" : settings.presetId,
  );
}

export function buildToolInstructions(settings: AgentHarnessSettings): string {
  const enabled = settings.enabledTools.join(", ");
  return [
    "Herramientas habilitadas:",
    enabled || "(ninguna — responde solo con texto)",
    "Cuando el caso esté listo, propose_scenario. Para un ajuste puntual, patch_draft. Para confirmar, apply_scenario.",
  ].join("\n");
}

export function composeRuntimeSystemPrompt(
  settings: AgentHarnessSettings,
  contextPack: string,
): string {
  const prompt = resolveEditableSystemPrompt(settings);
  const parts = [prompt, buildToolInstructions(settings)];
  if (contextPack.trim()) {
    parts.push(contextPack.trim());
  }
  return parts.filter(Boolean).join("\n\n---\n\n");
}
