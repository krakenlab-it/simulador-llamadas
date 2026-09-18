import { describe, expect, it } from "vitest";
import { validateAuthoringDraft } from "@/lib/scenarios/authoring";
import {
  EXAMPLE_PACK_IDS,
  getExamplePack,
  listExamplePacks,
} from "@/lib/scenarios/example-packs";

describe("Jaime example packs", () => {
  it("ships Kraken Flow, Me We, Wellness and Global Green as saveable drafts", () => {
    expect(EXAMPLE_PACK_IDS).toEqual([
      "kraken-flow",
      "me-we",
      "wellness",
      "global-green",
    ]);
    const packs = listExamplePacks();
    expect(packs).toHaveLength(4);
    expect(new Set(packs.map((pack) => pack.draft.clientName)).size).toBe(4);
    for (const pack of packs) {
      expect(validateAuthoringDraft(pack.draft)).toBeNull();
      expect(pack.clientPack.decisionRole).toMatch(/decisor|influenciador|guardian/);
      expect(pack.clientPack.sellerObjective).toMatch(/hora|jueves|martes|viernes|miércoles/i);
    }
  });

  it("keeps Valeria Soto as the Kraken Flow buyer", () => {
    const pack = getExamplePack("kraken-flow");
    expect(pack?.draft.clientName).toBe("Valeria Soto");
    expect(pack?.draft.productSold).toMatch(/Kraken Flow/i);
    expect(pack?.clientPack.forbiddenClaims).toContain("reemplazar el ERP");
    expect(pack?.draft.clientPack).toEqual(pack?.clientPack);
    expect(getExamplePack("unknown")).toBeUndefined();
  });
});
