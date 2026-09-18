import { describe, expect, it } from "vitest";
import {
  applyPreset,
  applySystemPrompt,
  DEFAULT_AGENT_SETTINGS,
  parseAgentHarnessSettings,
} from "@/lib/agent";

describe("agent settings", () => {
  it("defaults to coach, auto runtime, Gateway → DeepSeek preference and hidden advanced knobs", () => {
    expect(DEFAULT_AGENT_SETTINGS.presetId).toBe("coach");
    expect(DEFAULT_AGENT_SETTINGS.runtime).toBe("auto");
    expect(DEFAULT_AGENT_SETTINGS.providerPreference).toBe("auto");
    expect(DEFAULT_AGENT_SETTINGS.visibility.advancedOpen).toBe(false);
    expect(DEFAULT_AGENT_SETTINGS.visibility.showSystemPrompt).toBe(true);
    expect(DEFAULT_AGENT_SETTINGS.systemPrompt).toMatch(/agente de diseño/i);
    expect(DEFAULT_AGENT_SETTINGS.voiceAgent.clientLayer).toEqual({
      motorEnabled: true,
      toneId: "auto",
    });
  });

  it("clamps junk and applies presets / custom prompts", () => {
    const parsed = parseAgentHarnessSettings({
      temperature: 9,
      maxSteps: 99,
      runtime: "nope",
      enabledTools: ["not-a-tool"],
    });
    expect(parsed.temperature).toBe(1.2);
    expect(parsed.maxSteps).toBe(8);
    expect(parsed.runtime).toBe("auto");
    expect(parsed.enabledTools).toContain("propose_scenario");

    const cierre = applyPreset(DEFAULT_AGENT_SETTINGS, "cierre");
    expect(cierre.callType).toBe("cierre");
    expect(cierre.systemPrompt).toMatch(/cierre/i);

    const custom = applySystemPrompt(cierre, "Sé breve y pide día y hora");
    expect(custom.presetId).toBe("custom");
  });
});
