import { describe, expect, it } from "vitest";
import {
  initialEmotionalMeters,
  updateEmotionalMeters,
} from "@/lib/agentic/emotional-meters";
import type { CallAnalytics } from "@/lib/scoring/types";

const baseAnalytics: CallAnalytics = {
  talkPercent: 55,
  longestMonologueSeconds: 0,
  questionTypes: { open: 0, closed: 0, clarifying: 0 },
  patienceAfterBuyerTurnSeconds: null,
  hasNextStep: false,
};

describe("emotional meters", () => {
  it("initializes meters from mapped Jaime difficulty", () => {
    expect(initialEmotionalMeters(2)).toEqual({
      confianza: 3,
      interes: 3,
      paciencia: 6,
    });
  });

  it("increases interest on open questions and drains patience on long monologues", () => {
    const start = initialEmotionalMeters(2);
    const withQuestion = updateEmotionalMeters(start, {
      utterance: "Cuénteme, ¿qué está pasando con sus entregas esta temporada?",
      analytics: { ...baseAnalytics, questionTypes: { open: 1, closed: 0, clarifying: 0 } },
      temperament: "ocupado",
      turnNumber: 1,
      priorTurnNumber: 0,
    });
    expect(withQuestion.interes).toBeGreaterThan(start.interes);

    const longPitch = "somos líderes en soluciones integrales ".repeat(14);
    const withMonologue = updateEmotionalMeters(withQuestion, {
      utterance: longPitch,
      analytics: baseAnalytics,
      temperament: "impaciente",
      turnNumber: 2,
      priorTurnNumber: 1,
    });
    expect(withMonologue.paciencia).toBeLessThan(withQuestion.paciencia);
  });
});
