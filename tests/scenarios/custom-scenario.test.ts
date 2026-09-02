import { describe, expect, it } from "vitest";
import { buildScenarioConfig, buildDefaultRounds } from "@/lib/scenarios/defaults";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { scoreTranscriptHeuristic } from "@/lib/scoring/heuristic-scorecard";
import { isClinicPreset } from "@/lib/scenarios/types";
import { GOOD_DISCOVERY_TRANSCRIPT } from "../fixtures/scoring/transcripts";

describe("custom scenarios", () => {
  const tireShopConfig = buildScenarioConfig({
    industry: "taller de llantas",
    productSold: "llantas premium Michelin",
    clientProblem: "rotación de inventario lenta en temporada baja",
    objections: ["Ya tengo proveedor", "Los márgenes están apretados"],
    winCriteria: "SPIN Advance: visita al taller con acción concreta",
    temperament: "Escéptico, directo",
    clientName: "Carlos Ruiz",
  });

  it("builds industry-specific scenario config", () => {
    expect(tireShopConfig.criteria.length).toBeGreaterThan(5);
    expect(tireShopConfig.rounds).toHaveLength(5);
    expect(tireShopConfig.language).toBe("es");
  });

  it("scores tire shop utterance on 6 dimensions, not caseta keywords", async () => {
    const utterance =
      "Entiendo la rotación lenta en su taller de llantas. ¿Qué ha probado para mover inventario Michelin y qué resultado vio?";
    const live = await scoreLiveTurn({
      utterance,
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: tireShopConfig.rounds[0].goal,
      difficultyLevel: 2,
      scenarioSlug: "taller-carlos",
      isPreset: false,
      config: tireShopConfig,
      clientName: "Carlos Ruiz",
      isLastRound: false,
      priorLines: [{ role: "client", text: "¿Quién habla?" }],
    });

    expect(live.analytics.questionTypes.open).toBeGreaterThan(0);
    expect(live.coaching.note).toBeTruthy();

    const card = scoreTranscriptHeuristic({
      lines: [
        { role: "client", text: "¿Quién habla?" },
        { role: "trainee", text: utterance },
      ],
      config: tireShopConfig,
      isPreset: false,
    });
    expect(card.dimensions).toHaveLength(6);
    expect(card.overallScore).toBeGreaterThan(0);
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

describe("clinic preset", () => {
  it("identifies clinic presets", () => {
    expect(isClinicPreset("mariana")).toBe(true);
    expect(isClinicPreset("custom-gym")).toBe(false);
  });

  it("scores gym discovery transcript without cpm/ctr/roi jerga dimension", () => {
    const config = buildScenarioConfig({
      industry: "gimnasio boutique",
      productSold: "membresía premium",
      clientProblem: "baja retención",
      objections: ["Caro"],
      winCriteria: "SPIN Advance",
      temperament: "Escéptico",
      clientName: "Ana",
    });
    const card = scoreTranscriptHeuristic({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config,
      isPreset: false,
    });
    expect(card.dimensions.find((d) => d.id === "valor_tailor")?.score).toBeGreaterThan(0);
  });
});

