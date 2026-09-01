import { describe, expect, it, beforeEach } from "vitest";
import {
  stubCreateScenario,
  stubCreateSession,
  stubEndSession,
  stubSubmitTurn,
  resetStubSessions,
} from "@/lib/api/stubs";

describe("custom scenario stubs", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("creates and runs a custom scenario session with rich evaluation", async () => {
    const scenario = stubCreateScenario({
      industry: "gimnasio",
      productSold: "membresía anual",
      clientName: "Laura Méndez",
      clientTitle: "Gerente",
      companyContext: "Cadena de gimnasios",
      temperament: "Impaciente",
      difficultyLabel: "Media",
      clientProblem: "baja retención de socios",
      objections: ["Muy caro"],
      winCriteria: "SPIN Advance: visita con acción concreta",
    });

    const session = stubCreateSession({
      scenarioSlug: scenario.slug,
      mode: "texto",
      difficultyLevel: 2,
    });

    expect(session.isPreset).toBe(false);
    expect(session.totalRounds).toBe(5);

    const turn = await stubSubmitTurn(session.callAttemptId, {
      utterance:
        "Entiendo la retención en su gimnasio. ¿Qué ha probado y qué resultado vio?",
    });

    expect(turn.richFeedback.whyScore).toBeTruthy();
    expect(turn.richFeedback.analytics).toBeDefined();

    const ended = await stubEndSession(session.callAttemptId);
    expect(ended.evaluation).toBeDefined();
    expect(ended.evaluation.nextDrill).toBeTruthy();
    expect(ended.evaluation.scorecard).toBeDefined();
    expect(ended.totalRounds).toBe(5);
  });
});
