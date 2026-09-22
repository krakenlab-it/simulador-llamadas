import { describe, expect, it } from "vitest";
import { parseCatalogClientPackSeed } from "@/lib/agent/client-layer";
import {
  buildClientPack,
  buildClientPackFromSlug,
  describeClientLayerForTrainer,
  formatClientPack,
} from "@/lib/agent/client-pack";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";

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
    expect(rodrigo?.decisionRole).toBe("influenciador");
    expect(efrain?.decisionRole).toBe("guardian");
    expect(rodrigo?.realObjection).not.toBe(efrain?.realObjection);
    expect(rodrigo?.channel).toBe("texto");
    expect(rodrigo?.difficultyJaime).toBe(5);
    expect(efrain?.sellerObjective).toMatch(/miércoles/i);
    expect(rodrigo?.grantConditions).toMatch(/director/i);
    expect(efrain?.grantConditions).toMatch(/dueño|filtras/i);
    expect(rodrigo?.grantConditions).toMatch(/viernes a las 9/i);
    expect(efrain?.grantConditions).toMatch(/confirma ESE slot/i);
    expect(buildClientPackFromSlug("unknown", 1)).toBeNull();
  });

  it("builds a custom pack from a persisted config seed", () => {
    const config = buildPresetScenarioConfig("mariana");
    expect(config).not.toBeNull();
    const seed = parseCatalogClientPackSeed({
      decisionRole: "influenciador",
      howTheyWorkToday: "WhatsApp y eventos sueltos",
      onTheirMind: "La comunidad se enfría a los 30 días",
      allowedFacts: ["Retención de miembros a 30 días"],
      forbiddenClaims: ["garantía de membresías"],
      realObjection: "Ya probaron una app y la gente no volvió",
      grantConditions: "Que midan hábito semanal, no descargas",
      sellerObjective: "Una llamada el martes a las 9",
    });
    expect(seed).toBeDefined();
    const pack = buildClientPack({
      clientName: "Camila Rivas",
      clientTitle: "Head de Comunidad",
      company: "Me We",
      config: { ...config!, clientPack: seed },
      seed,
      difficultyLevel: 2,
      mode: "texto",
    });
    expect(pack.decisionRole).toBe("influenciador");
    expect(pack.forbiddenClaims).toContain("garantía de membresías");
    expect(pack.sellerObjective).toMatch(/martes/);
    expect(parseCatalogClientPackSeed({ decisionRole: "nope" })).toBeUndefined();
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
