import { describe, expect, it, beforeEach } from "vitest";
import {
  stubCreateSession,
  stubSubmitTurn,
  stubEndSession,
  stubListHistory,
  resetStubSessions,
} from "@/lib/api/stubs";
import { scoreUtterance } from "@/lib/extension-points/scoring";
import { CLIENTS } from "@/lib/clients";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";

describe("API stubs", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("creates a session for a valid client", () => {
    const session = stubCreateSession({
      scenarioSlug: "mariana",
      mode: "texto",
      difficultyLevel: 2,
    });
    expect(session.callAttemptId).toMatch(/^stub-/);
    expect(session.scenarioSlug).toBe("mariana");
    expect(session.currentRound).toBe(1);
  });

  it("runs a five-round loop and evaluates", () => {
    const session = stubCreateSession({
      scenarioSlug: "efrain",
      mode: "voz",
      difficultyLevel: 1,
    });

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
      expect(res.roundType).toBeDefined();
      expect(res.feedback).toBe(ROUND_EXPECTED[res.roundType]);
      expect(res.roundNumber).toBe(i + 1);
    }

    const final = stubEndSession(session.callAttemptId);
    expect(final.turnsCompleted).toBe(5);
    expect(final.won).toBe(true);
    expect(final.totalScore).toBeGreaterThan(0);
    expect(final.callAttemptId).toBe(session.callAttemptId);
    expect(final.status).toBe("completed");
  });

  it("rejects unknown client slug", () => {
    expect(() =>
      stubCreateSession({
        scenarioSlug: "unknown",
        mode: "texto",
        difficultyLevel: 1,
      }),
    ).toThrow("Cliente no encontrado");
  });

  it("lists history for trainee after completed call", () => {
    const session = stubCreateSession({
      scenarioSlug: "mariana",
      mode: "texto",
      difficultyLevel: 1,
    });

    stubSubmitTurn(session.callAttemptId, {
      utterance: "Entiendo el problema de medición",
    });
    stubEndSession(session.callAttemptId);

    const history = stubListHistory(session.traineeId);
    expect(history).toHaveLength(1);
    expect(history[0].scenarioSlug).toBe("mariana");
    expect(history[0].clientName).toBe("Mariana Escobedo");
    expect(history[0].turnsCompleted).toBe(1);
  });
});

describe("scoring", () => {
  it("detects win on cierre with day and time", () => {
    const result = scoreUtterance({
      utterance: "Agendemos reunión el martes 15 a las 10:30",
      roundType: "cierre",
      difficultyLevel: 1,
      scenarioSlug: "efrain",
    });
    expect(result.won).toBe(true);
    expect(result.roundScore).toBeGreaterThan(0);
  });

  it("does not win without concrete day and time", () => {
    const result = scoreUtterance({
      utterance: "¿Podemos agendar una reunión pronto?",
      roundType: "cierre",
      difficultyLevel: 2,
      scenarioSlug: "efrain",
    });
    expect(result.won).toBe(false);
  });
});

describe("clients catalog", () => {
  it("has exactly three clients", () => {
    expect(CLIENTS).toHaveLength(3);
    expect(CLIENTS.map((c) => c.slug)).toEqual([
      "mariana",
      "rodrigo",
      "efrain",
    ]);
  });
});
