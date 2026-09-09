import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildExampleAuthoringDraft } from "@/lib/scenarios/example-draft";
import {
  builderDraftKey,
  clearBuilderDraftFromStorage,
  loadBuilderDraftFromStorage,
  saveBuilderDraftToStorage,
  SCENARIO_BUILDER_DRAFT_STORAGE_KEY,
} from "@/lib/scenarios/builder-draft-storage";

describe("scenario builder draft storage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearBuilderDraftFromStorage("new");
    clearBuilderDraftFromStorage("valeria-soto-importaci-n-y-distribuci-n-vk68");
  });

  it("uses edit slug or new as draft key", () => {
    expect(builderDraftKey(null)).toBe("new");
    expect(builderDraftKey("valeria-soto-importaci-n-y-distribuci-n-vk68")).toBe(
      "valeria-soto-importaci-n-y-distribuci-n-vk68",
    );
  });

  it("restores dimensionGuides from stored draft", () => {
    const draft = buildExampleAuthoringDraft();
    draft.dimensionGuides.valor_tailor =
      "Conecta Kraken Flow con la posibilidad de llegar a las personas indicadas que quiere el colegio";
    draft.dimensionGuides.compostura_objecion =
      "Valida el ERP actual y propone pruebas de concepto y prueba de que funciona Kraken Flow";
    draft.dimensionGuides.cierre_siguiente_paso =
      "Agenda mesa jueves 10:00 con compras y operaciones para piloto de 3 semanas.";

    saveBuilderDraftToStorage({
      draftKey: "valeria-soto-importaci-n-y-distribuci-n-vk68",
      step: "success",
      draft,
    });

    const restored = loadBuilderDraftFromStorage("valeria-soto-importaci-n-y-distribuci-n-vk68");
    expect(restored?.step).toBe("success");
    expect(restored?.draft.dimensionGuides.valor_tailor).toContain("Kraken Flow");
    expect(restored?.draft.dimensionGuides.compostura_objecion).toContain("ERP");
    expect(restored?.draft.dimensionGuides.cierre_siguiente_paso).toContain("jueves 10:00");
    expect(store[SCENARIO_BUILDER_DRAFT_STORAGE_KEY]).toBeTruthy();
  });

  it("clears only the matching draft key", () => {
    saveBuilderDraftToStorage({
      draftKey: "valeria-soto-importaci-n-y-distribuci-n-vk68",
      step: "success",
      draft: buildExampleAuthoringDraft(),
    });

    clearBuilderDraftFromStorage("valeria-soto-importaci-n-y-distribuci-n-vk68");

    expect(
      loadBuilderDraftFromStorage("valeria-soto-importaci-n-y-distribuci-n-vk68"),
    ).toBeNull();
  });
});
