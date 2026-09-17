import { describe, expect, it } from "vitest";
import { applySystemPrompt, DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import {
  AGENT_SETTINGS_STORAGE_KEY,
  readStoredAgentSettings,
  writeStoredAgentSettings,
} from "@/lib/agent/storage";

describe("agent settings storage", () => {
  it("round-trips a custom prompt without storing secrets", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };

    const next = applySystemPrompt(DEFAULT_AGENT_SETTINGS, "Prompt de prueba.");
    writeStoredAgentSettings(storage, next);
    expect(memory.get(AGENT_SETTINGS_STORAGE_KEY)).not.toMatch(/GROQ|sk-|gsk_/);

    const restored = readStoredAgentSettings(storage);
    expect(restored.systemPrompt).toBe("Prompt de prueba.");
    expect(restored.presetId).toBe("custom");
  });

  it("falls back to defaults on junk", () => {
    const restored = readStoredAgentSettings({
      getItem: () => "{not-json",
    });
    expect(restored.presetId).toBe("coach");
  });
});
