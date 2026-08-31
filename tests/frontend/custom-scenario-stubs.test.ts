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

  it("creates and runs a custom scenario session with rich evaluation", () => {
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
      winCriteria: "Visita con día y hora",
    });

    const session = stubCreateSession({
      scenarioSlug: scenario.slug,
      mode: "texto",
      difficultyLevel: 2,
    });

    expect(session.isPreset).toBe(false);
    expect(session.totalRounds).toBe(5);

    const turn = stubSubmitTurn(session.callAttemptId, {
      utterance:
        "Entiendo el problema de retención en su gimnasio y propongo medir socios activos.",
    });

    expect(turn.richFeedback.whyScore).toBeTruthy();
    expect(turn.richFeedback.strongerLine).toBeTruthy();

    const ended = stubEndSession(session.callAttemptId);
    expect(ended.evaluation).toBeDefined();
    expect(ended.evaluation.nextDrill).toBeTruthy();
    expect(ended.totalRounds).toBe(5);
  });
});
