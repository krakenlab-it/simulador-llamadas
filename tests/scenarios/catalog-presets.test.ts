import { describe, expect, it } from "vitest";
import {
  catalogQuestionBanks,
  questionsOverlapAcrossPresets,
  reactionsOverlapAcrossPresets,
  listCatalogPresets,
} from "@/lib/scenarios/catalog-presets";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { CLIENTS } from "@/lib/clients";
import { getClientReply } from "@/lib/scoring/reactions";

describe("PREFILLED catalog presets", () => {
  it("keeps the three clinic identities and distinct practice briefs", () => {
    const presets = listCatalogPresets();
    expect(presets.map((item) => item.slug)).toEqual([
      "mariana",
      "rodrigo",
      "efrain",
    ]);
    expect(presets.map((item) => item.name)).toEqual([
      "Mariana Escobedo",
      "Rodrigo Nava",
      "Efraín Loera",
    ]);
    const briefs = presets.map((item) => item.practiceBrief);
    expect(new Set(briefs).size).toBe(3);
    expect(CLIENTS).toHaveLength(3);
    expect(CLIENTS[0].practiceBrief).toContain("caseta");
  });

  it("does not share questions or scripted replies across clients", () => {
    expect(questionsOverlapAcrossPresets()).toEqual([]);
    expect(reactionsOverlapAcrossPresets()).toEqual([]);
    const banks = catalogQuestionBanks();
    expect(banks.mariana[0]).toMatch(/caseta/i);
    expect(banks.rodrigo[0]).toMatch(/proximidad|tienda|m²|m2/i);
    expect(banks.efrain[0]).toMatch(/piso|clics/i);
  });

  it("builds richer preset config and unique live replies", () => {
    const rodrigo = buildPresetScenarioConfig("rodrigo");
    expect(rodrigo?.industry).toContain("farmacias");
    expect(rodrigo?.openingLines).toContain(
      "Si es otro discurso de branding, cuelgo.",
    );
    expect(rodrigo?.winCriteria).toMatch(/hora/i);
    expect(getClientReply("mariana", "objecion", "medio")).not.toBe(
      getClientReply("rodrigo", "objecion", "medio"),
    );
    expect(getClientReply("efrain", "cierre", "bien")).toMatch(/piso|Miércoles/i);
  });
});
