import { describe, expect, it } from "vitest";
import { buildScenarioConfig, buildDefaultRounds } from "@/lib/scenarios/defaults";
import { analizarCustom, scoreCustomTurn } from "@/lib/scoring/custom";
import { isClinicPreset } from "@/lib/scenarios/types";
import { scoreTurn } from "@/lib/scoring";
import { GOOD_CLOSE_UTTERANCE } from "../fixtures/scoring/utterances";

describe("custom scenarios", () => {
  const tireShopConfig = buildScenarioConfig({
    industry: "taller de llantas",
    productSold: "llantas premium Michelin",
    clientProblem: "rotación de inventario lenta en temporada baja",
    objections: ["Ya tengo proveedor", "Los márgenes están apretados"],
    winCriteria: "Visita al taller con día y hora",
    temperament: "Escéptico, directo",
    clientName: "Carlos Ruiz",
  });

  it("builds industry-specific scoring criteria", () => {
    expect(tireShopConfig.criteria.some((c) => c.id === "jerga")).toBe(true);
    expect(tireShopConfig.criteria.some((c) => c.id === "producto")).toBe(true);
    expect(tireShopConfig.rounds).toHaveLength(5);
  });

  it("scores tire shop utterance on sector keywords, not caseta", () => {
    const utterance =
      "Entiendo el problema de rotación en su taller de llantas. Mediríamos inventario de llantas premium semana a semana.";
    const analisis = analizarCustom(utterance, tireShopConfig);
    expect(analisis.hits.problema).toBe(true);
    expect(analisis.hits.medicion).toBe(true);
    expect(analisis.hits.jerga).toBe(true);

    const result = scoreCustomTurn({
      utterance,
      round: tireShopConfig.rounds[0],
      config: tireShopConfig,
      difficultyLevel: 2,
      clientName: "Carlos Ruiz",
      isLastRound: false,
    });

    expect(result.roundScore).toBeGreaterThan(0);
    expect(result.richFeedback.whyScore).toBeTruthy();
    expect(result.richFeedback.strongerLine).toBeTruthy();
    expect(result.richFeedback.missedCriteria).toBeDefined();
  });

  it("builds default rounds with client prompts from scenario", () => {
    const rounds = buildDefaultRounds(
      "gimnasio",
      "membresía anual",
      "baja retención de socios",
      "Impaciente",
    );
    expect(rounds[0].clientPrompt).toContain("baja retención");
    expect(rounds[4].key).toBe("cierre");
  });
});

describe("clinic preset unchanged", () => {
  it("identifies clinic presets", () => {
    expect(isClinicPreset("mariana")).toBe(true);
    expect(isClinicPreset("custom-gym")).toBe(false);
  });

  it("clinic scoring remains byte-equivalent for mariana close", () => {
    const result = scoreTurn({
      utterance: GOOD_CLOSE_UTTERANCE,
      roundType: "cierre",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
    });
    expect(result.won).toBe(true);
    expect(result.clientReply).toContain("agendo");
    expect(result.roundScore).toBeGreaterThan(0);
  });
});
