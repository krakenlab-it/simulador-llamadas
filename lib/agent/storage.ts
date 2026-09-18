import { parseAgentHarnessSettings } from "./settings";
import type { AgentHarnessSettings } from "./types";

export const AGENT_SETTINGS_STORAGE_KEY = "simulador:agent-harness-settings";

export function readStoredAgentSettings(
  storage: Pick<Storage, "getItem"> | null | undefined,
): AgentHarnessSettings {
  if (!storage) return parseAgentHarnessSettings(null);
  try {
    const raw = storage.getItem(AGENT_SETTINGS_STORAGE_KEY);
    if (!raw) return parseAgentHarnessSettings(null);
    return parseAgentHarnessSettings(JSON.parse(raw));
  } catch {
    return parseAgentHarnessSettings(null);
  }
}

export function writeStoredAgentSettings(
  storage: Pick<Storage, "setItem"> | null | undefined,
  settings: AgentHarnessSettings,
): void {
  if (!storage) return;
  storage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
