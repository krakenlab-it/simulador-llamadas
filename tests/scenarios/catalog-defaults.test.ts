import { describe, expect, it } from "vitest";
import {
  catalogPersonalityForSlug,
  catalogSetupDefaults,
  looksLikeStockVoiceDefaults,
  resolveHubVoiceAgent,
} from "@/lib/scenarios/catalog-defaults";
import { buildCatalogScenarioConfig } from "@/lib/scenarios/catalog-presets";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
} from "@/lib/voice/agent-settings";

describe("catalog first-open defaults", () => {
  it("prefills Spanish, auto gender, live motor, and character personality", () => {
    expect(catalogPersonalityForSlug("mariana")).toBe("esceptico");
    expect(catalogPersonalityForSlug("rodrigo")).toBe("impaciente");
    expect(catalogPersonalityForSlug("efrain")).toBe("esceptico");
    expect(catalogPersonalityForSlug("unknown")).toBe("neutral");

    expect(catalogSetupDefaults("mariana")).toEqual({
      ...DEFAULT_VOICE_AGENT_SETTINGS,
      language: "es",
      voiceGender: "auto",
      personality: "esceptico",
      clientLayer: { motorEnabled: true, toneId: "auto" },
    });
    expect(catalogSetupDefaults("rodrigo").personality).toBe("impaciente");
  });

  it("treats factory knobs as stock and leaves trainer overrides alone", () => {
    expect(looksLikeStockVoiceDefaults(DEFAULT_VOICE_AGENT_SETTINGS)).toBe(true);
    expect(
      looksLikeStockVoiceDefaults({
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        language: "en",
      }),
    ).toBe(false);
    expect(
      looksLikeStockVoiceDefaults({
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        clientLayer: { motorEnabled: false, toneId: "auto" },
      }),
    ).toBe(false);
    expect(
      looksLikeStockVoiceDefaults({
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        personality: "esceptico",
      }),
    ).toBe(false);
  });

  it("applies catalog knobs on first open and keeps a saved replay", () => {
    expect(resolveHubVoiceAgent(marianaScenarioFixture).personality).toBe(
      "esceptico",
    );
    expect(resolveHubVoiceAgent(marianaScenarioFixture).clientLayer).toEqual({
      motorEnabled: true,
      toneId: "auto",
    });

    const saved = resolveHubVoiceAgent({
      ...marianaScenarioFixture,
      voiceAgent: parseVoiceAgentSettings({
        language: "en",
        voiceGender: "female",
        personality: "paciente",
        clientLayer: { motorEnabled: false, toneId: "suave" },
      }),
    });
    expect(saved.language).toBe("en");
    expect(saved.personality).toBe("paciente");
    expect(saved.clientLayer).toEqual({ motorEnabled: false, toneId: "suave" });
  });

  it("persists the pack seed on catalog scenario config so the motor sees grant rules", () => {
    const config = buildCatalogScenarioConfig("mariana");
    expect(config?.language).toBe("es");
    expect(config?.clientPack?.decisionRole).toBe("decisor");
    expect(config?.clientPack?.grantConditions).toMatch(/confirma ESE slot/i);
  });
});
