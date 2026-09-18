import { describe, expect, it } from "vitest";
import {
  buildClientPackFromSlug,
  describeClientLayerForTrainer,
  formatClientPack,
} from "@/lib/agent/client-pack";

describe("client scenario pack", () => {
  it("builds Jaime-style case data from the PREFILLED catalog", () => {
    const pack = buildClientPackFromSlug("mariana", 2, "voz");
    expect(pack).not.toBeNull();
    expect(pack?.clientName).toBe("Mariana Escobedo");
    expect(pack?.decisionRole).toBe("decisor");
    expect(pack?.difficultyJaime).toBe(3);
    expect(pack?.channel).toBe("voz");
    expect(pack?.encounterType).toBe("fria");
    expect(pack?.realObjection).toMatch(/agencia/i);
    expect(pack?.allowedFacts.some((fact) => /caseta/i.test(fact))).toBe(true);
    expect(pack?.forbiddenClaims).toContain("garantía de visitas a caseta");

    const formatted = formatClientPack(pack!);
    expect(formatted).toMatch(/PACK DEL ESCENARIO/);
    expect(formatted).toMatch(/Hechos permitidos/);
    expect(formatted).toMatch(/Objeción real/);
  });

  it("keeps Rodrigo and Efraín as distinct packs", () => {
    const rodrigo = buildClientPackFromSlug("rodrigo", 3, "texto");
    const efrain = buildClientPackFromSlug("efrain", 1, "voz");
    expect(rodrigo?.realObjection).not.toBe(efrain?.realObjection);
    expect(rodrigo?.channel).toBe("texto");
    expect(rodrigo?.difficultyJaime).toBe(5);
    expect(efrain?.sellerObjective).toMatch(/miércoles/i);
    expect(buildClientPackFromSlug("unknown", 1)).toBeNull();
  });

  it("explains the knobs to a facilitator in one line", () => {
    expect(
      describeClientLayerForTrainer({ motorEnabled: true, toneId: "auto" }),
    ).toMatch(/Cliente en vivo/);
    expect(
      describeClientLayerForTrainer({ motorEnabled: false, toneId: "molesto" }),
    ).toMatch(/Motor apagado/);
  });
});
