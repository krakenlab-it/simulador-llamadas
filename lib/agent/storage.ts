import { parseAgentHarnessSettings } from "./settings";
import { DEFAULT_AGENT_SETTINGS } from "./settings";
import type { AgentHarnessSettings } from "./types";

export const AGENT_SETTINGS_STORAGE_KEY = "simulador:agent-harness-settings";

export function readStoredAgentSettings(
  storage: Pick<Storage, "getItem"> | null | undefined,
): AgentHarnessSettings {
  if (!storage) return { ...DEFAULT_AGENT_SETTINGS };
  try {
    const raw = storage.getItem(AGENT_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AGENT_SETTINGS };
    return parseAgentHarnessSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AGENT_SETTINGS };
  }
}

export function writeStoredAgentSettings(
  storage: Pick<Storage, "setItem"> | null | undefined,
  settings: AgentHarnessSettings,
): void {
  if (!storage) return;
  storage.setItem(
    AGENT_SETTINGS_STORAGE_KEY,
    JSON.stringify(parseAgentHarnessSettings(settings)),
  );
}
