import { describe, expect, it } from "vitest";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";

describe("scoring extension point", () => {
  it("live turn scoring returns analytics evidence", async () => {
    const result = await scoreLiveTurn({
      utterance:
        "Entiendo el problema de medición. ¿Qué impacto tiene hoy en visitas a caseta?",
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: "Discovery",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config: null,
      clientName: "Mariana",
      isLastRound: false,
      priorLines: [],
    });

    expect(result.analytics.questionTypes.open).toBeGreaterThan(0);
    expect(result.engagementScore).toBeGreaterThan(0);
  });
});
