import { describe, expect, it } from "vitest";
import { packAgentContext } from "@/lib/agent/context";
import { buildVisibilityView } from "@/lib/agent/visibility";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent";
import { emptyAuthoringDraft } from "@/lib/scenarios/authoring";

describe("context packing and visibility", () => {
  it("packs catalog, draft and voice when enabled", () => {
    const draft = emptyAuthoringDraft("es");
    draft.clientName = "Laura";
    const pack = packAgentContext({
      settings: DEFAULT_AGENT_SETTINGS,
      catalog: [
        {
          slug: "mariana",
          clientName: "Mariana Escobedo",
          clientTitle: "Directora",
          industry: "Vivienda",
          isPreset: true,
        },
      ],
      draft,
    });
    expect(pack).toMatch(/PREFILLED/);
    expect(pack).toMatch(/Laura/);
    expect(pack).toMatch(/Voz del cliente/);
  });

  it("omits sections when toggled off and hides traces on the happy path", () => {
    const pack = packAgentContext({
      settings: {
        ...DEFAULT_AGENT_SETTINGS,
        includeCatalog: false,
        includeDraft: false,
        includeVoiceSettings: false,
      },
      catalog: [
        {
          slug: "mariana",
          clientName: "Mariana Escobedo",
          clientTitle: "Directora",
          industry: "Vivienda",
          isPreset: true,
        },
      ],
      draft: emptyAuthoringDraft("es"),
    });
    expect(pack).toBe("");
    const view = buildVisibilityView(DEFAULT_AGENT_SETTINGS, {
      contextPack: "secret-context",
      traces: [{ toolId: "list_catalog", ok: true, summary: "ok" }],
      roles: { agent: "a", user: "u", context: "c" },
    });
    expect(view.tools).toEqual([]);
    expect(view.traces).toEqual([]);
    expect(view.contextPack).toBe("");
  });
});
