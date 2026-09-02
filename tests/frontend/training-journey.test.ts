import { describe, expect, it, beforeEach } from "vitest";
import {
  stubCreateSession,
  stubSubmitTurn,
  stubEndSession,
  resetStubSessions,
} from "@/lib/api/stubs";
import {
  beginStarting,
  enterCall,
  enterResults,
  initialFlowState,
  resetToTrain,
} from "@/lib/frontend/flow";
import { canStartTraining } from "@/lib/frontend/training-readiness";

/**
 * End-to-end journey test for the main trainee flow:
 * pick scenario → start → five rounds → hang up → results.
 * Uses API stubs (no network) and mirrors SimulatorApp state transitions.
 */
describe("training journey (main user flow)", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("runs scenario → start → 5 rounds → hang up → score", async () => {
    let flow = initialFlowState();

    const readiness = {
      scenarioSelected: true,
      mode: "texto" as const,
      speechSupported: true,
      micVerified: false,
      isStarting: false,
    };
    expect(canStartTraining(readiness)).toBe(true);

    flow = beginStarting(flow);
    expect(flow.phase).toBe("starting");

    const session = stubCreateSession({
      scenarioSlug: "efrain",
      mode: "texto",
      difficultyLevel: 2,
    });

    flow = enterCall();
    expect(flow.view).toBe("call");

    const utterances = [
      "Entiendo el problema de medición. ¿Qué le cuesta más hoy en visitas a caseta?",
      "Comprendo su duda. ¿Qué ha probado para mejorar el tráfico?",
      "Si esto sigue tres meses, ¿qué impacto tendría en ingresos?",
      "Con su permiso le envío un caso breve y hablamos el jueves.",
      "Agendemos reunión el martes 15 a las 10:30 para definir el piloto.",
    ];

    for (let i = 0; i < utterances.length; i++) {
      const res = await stubSubmitTurn(session.callAttemptId, {
        utterance: utterances[i],
      });
      expect(res.roundNumber).toBe(i + 1);
      expect(res.richFeedback.whyScore.length).toBeGreaterThan(5);
    }

    flow = enterResults();
    expect(flow.view).toBe("results");

    const final = await stubEndSession(session.callAttemptId);
    expect(final.turnsCompleted).toBe(5);
    expect(final.won).toBe(true);
    expect(final.totalScore).toBeGreaterThan(0);
    expect(final.evaluation.nextDrill).toBeTruthy();
    expect(final.evaluation.scorecard).toBeDefined();

    flow = resetToTrain();
    expect(flow.view).toBe("train");
    expect(flow.phase).toBe("idle");
  });

  it("lands on home after login-style reset", () => {
    const home = initialFlowState();
    expect(home.view).toBe("home");
  });

  it("supports early hang up with partial scoring", async () => {
    const session = stubCreateSession({
      scenarioSlug: "mariana",
      mode: "texto",
      difficultyLevel: 1,
    });

    await stubSubmitTurn(session.callAttemptId, {
      utterance: "Buenos días, ¿qué le cuesta más hoy en medición?",
    });

    let flow = enterCall();
    flow = enterResults();

    const ended = await stubEndSession(session.callAttemptId);
    expect(ended.turnsCompleted).toBe(1);
    expect(ended.won).toBe(false);
    expect(flow.view).toBe("results");
  });
});
