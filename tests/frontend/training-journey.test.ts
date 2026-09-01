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
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";

/**
 * End-to-end journey test for the main trainee flow:
 * pick scenario → start → five rounds → hang up → results.
 * Uses API stubs (no network) and mirrors SimulatorApp state transitions.
 */
describe("training journey (main user flow)", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("runs scenario → start → 5 rounds → hang up → score", () => {
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
      "Entiendo el problema de medición en visitas a caseta",
      "Comprendo, el ROI y KPI son clave en su sector",
      "Mediríamos el problema concreto de tráfico al piso",
      "¿Le parece si le mando un correo breve con el caso?",
      "Agendemos reunión el martes 15 a las 10:30",
    ];

    for (let i = 0; i < utterances.length; i++) {
      const res = stubSubmitTurn(session.callAttemptId, {
        utterance: utterances[i],
      });
      expect(res.roundNumber).toBe(i + 1);
      expect(res.feedback).toBe(ROUND_EXPECTED[res.roundType]);
    }

    flow = enterResults();
    expect(flow.view).toBe("results");

    const final = stubEndSession(session.callAttemptId);
    expect(final.turnsCompleted).toBe(5);
    expect(final.won).toBe(true);
    expect(final.totalScore).toBeGreaterThan(0);
    expect(final.evaluation.nextDrill).toBeTruthy();

    flow = resetToTrain();
    expect(flow.view).toBe("train");
    expect(flow.phase).toBe("idle");
  });

  it("supports early hang up with partial scoring", () => {
    const session = stubCreateSession({
      scenarioSlug: "mariana",
      mode: "texto",
      difficultyLevel: 1,
    });

    stubSubmitTurn(session.callAttemptId, {
      utterance: "Buenos días, le llamo por un tema de medición",
    });

    let flow = enterCall();
    flow = enterResults();

    const ended = stubEndSession(session.callAttemptId);
    expect(ended.turnsCompleted).toBe(1);
    expect(ended.won).toBe(false);
    expect(flow.view).toBe("results");
  });
});
