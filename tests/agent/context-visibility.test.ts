import { describe, expect, it } from "vitest";
import { packAgentContext } from "@/lib/agent/context";
import { DEFAULT_AGENT_SETTINGS, parseAgentHarnessSettings } from "@/lib/agent/settings";
import { buildVisibilityView } from "@/lib/agent/visibility";
import { emptyAuthoringDraft } from "@/lib/scenarios/authoring";

describe("agent context and visibility", () => {
  it("packs catalog, draft, and voice when included", () => {
    const draft = emptyAuthoringDraft("es");
    draft.clientName = "Laura";
    const packed = packAgentContext({
      settings: DEFAULT_AGENT_SETTINGS,
      catalog: [
        {
          slug: "mariana",
          clientName: "Mariana Escobedo",
          clientTitle: "Directora",
          industry: "vivienda",
          isPreset: true,
          language: "es",
        },
      ],
      draft,
    });
    expect(packed).toContain("Mariana Escobedo");
    expect(packed).toContain("Laura");
    expect(packed).toContain("Voz del cliente simulado");
  });

  it("omits hidden context sections", () => {
    const packed = packAgentContext({
      settings: parseAgentHarnessSettings({
        includeCatalog: false,
        includeDraft: false,
        includeVoiceSettings: false,
      }),
      catalog: [],
      draft: null,
    });
    expect(packed).toBe("");
  });

  it("keeps tools and traces off the happy path", () => {
    const view = buildVisibilityView({
      settings: DEFAULT_AGENT_SETTINGS,
      contextPack: "contexto",
      traces: [{ toolId: "propose_scenario", input: {}, output: {} }],
      draft: null,
    });
    expect(view.showSystemPrompt).toBe(true);
    expect(view.showTools).toBe(false);
    expect(view.showTraces).toBe(false);
    expect(view.traces).toEqual([]);
  });
});
