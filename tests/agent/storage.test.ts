import { describe, expect, it } from "vitest";
import {
  AGENT_SETTINGS_STORAGE_KEY,
  DEFAULT_AGENT_SETTINGS,
  readStoredAgentSettings,
  writeStoredAgentSettings,
} from "@/lib/agent";

describe("agent settings storage", () => {
  it("round-trips settings and ignores junk without storing secrets", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    writeStoredAgentSettings(storage, {
      ...DEFAULT_AGENT_SETTINGS,
      temperature: 0.8,
    });
    expect(store.get(AGENT_SETTINGS_STORAGE_KEY)).not.toMatch(/DEEPSEEK|API_KEY/);
    const read = readStoredAgentSettings(storage);
    expect(read.temperature).toBe(0.8);
    expect(readStoredAgentSettings({ getItem: () => "nope" }).presetId).toBe(
      "coach",
    );
  });
});
