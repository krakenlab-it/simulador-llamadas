import { describe, expect, it } from "vitest";
import {
  AGENT_PRESETS,
  applyPreset,
  applySystemPrompt,
  DEFAULT_AGENT_SETTINGS,
  parseAgentHarnessSettings,
} from "@/lib/agent";
import { AGENT_TOOL_IDS } from "@/lib/agent/types";

describe("agent harness settings", () => {
  it("defaults to the coach preset with every tool on and advanced hidden", () => {
    expect(DEFAULT_AGENT_SETTINGS.presetId).toBe("coach");
    expect(DEFAULT_AGENT_SETTINGS.runtime).toBe("auto");
    expect(DEFAULT_AGENT_SETTINGS.enabledTools).toEqual([...AGENT_TOOL_IDS]);
    expect(DEFAULT_AGENT_SETTINGS.visibility.showSystemPrompt).toBe(true);
    expect(DEFAULT_AGENT_SETTINGS.visibility.showTools).toBe(false);
    expect(DEFAULT_AGENT_SETTINGS.visibility.advancedOpen).toBe(false);
    expect(DEFAULT_AGENT_SETTINGS.systemPrompt).toContain(
      "agente de diseño de escenarios",
    );
  });

  it("ignores unknown fields and clamps temperature / steps", () => {
    const parsed = parseAgentHarnessSettings({
      presetId: "nope",
      temperature: 9,
      maxSteps: 0,
      enabledTools: ["propose_scenario", "not-a-tool"],
      extra: true,
    });
    expect(parsed.presetId).toBe("coach");
    expect(parsed.temperature).toBe(1.2);
    expect(parsed.maxSteps).toBe(1);
    expect(parsed.enabledTools).toEqual(["propose_scenario"]);
  });

  it("applies a preset prompt and marks an edited prompt as custom", () => {
    const skeptico = applyPreset(DEFAULT_AGENT_SETTINGS, "esceptico");
    expect(skeptico.presetId).toBe("esceptico");
    expect(skeptico.systemPrompt).toBe(
      AGENT_PRESETS.find((preset) => preset.id === "esceptico")?.systemPrompt,
    );

    const edited = applySystemPrompt(skeptico, "Sé más breve y pide día y hora.");
    expect(edited.presetId).toBe("custom");
    expect(edited.systemPrompt).toContain("Sé más breve");
  });

  it("syncs voice language with the case language", () => {
    const parsed = parseAgentHarnessSettings({
      language: "en",
      voiceAgent: { language: "es", personality: "impaciente" },
    });
    expect(parsed.language).toBe("en");
    expect(parsed.voiceAgent.language).toBe("en");
    expect(parsed.voiceAgent.personality).toBe("impaciente");
  });
});
