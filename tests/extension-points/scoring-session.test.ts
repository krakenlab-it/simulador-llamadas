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

  it("scores follow-up cierre turns using the cierre reaction bank", async () => {
    const result = await scoreLiveTurn({
      utterance:
        "¿Le parece el martes a las 10:30 para revisar el impacto en visitas a caseta?",
      roundKey: "cierre-6",
      roundType: "cierre",
      roundLabel: "Cierre",
      roundGoal: "",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config: null,
      clientName: "Mariana",
      isLastRound: false,
      priorLines: [],
    });

    expect(result.clientReply).toBeTruthy();
    expect(result.clientReply).not.toBe("Entiendo. Siga.");
  });
});
