import { describe, expect, it } from "vitest";
import {
  APERTURA_UTTERANCE,
  CLARIDAD_UTTERANCE,
  CORREO_UTTERANCE,
  FAIL_CLOSE_UTTERANCE,
  GOOD_CLOSE_UTTERANCE,
  LEVEL1_CLOSE_DAY_ONLY,
  OBJECION_UTTERANCE,
} from "../fixtures/scoring/utterances";
import { analizar } from "@/lib/scoring/analizar";
import { puntua } from "@/lib/scoring/rondas";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { evaluateAdvanceOutcome } from "@/lib/scoring/outcome";
import {
  detectConcreteDayAndTime,
  scoreUtterance,
} from "@/lib/extension-points/scoring";

describe("analizar() legacy keyword detection", () => {
  it("detects prototype keywords including se_presenta_solo", () => {
    const result = analizar(APERTURA_UTTERANCE);

    expect(result.hits.problema).toBe(false);
    expect(result.hits.medicion).toBe(true);
    expect(result.hits.jerga).toBe(true);
    expect(result.hits.reconocimiento).toBe(true);
    expect(result.hits.se_presenta_solo).toBe(true);
    expect(result.hits.monologo).toBe(false);
    expect(result.hits.telegrama).toBe(false);
  });
});

describe("RONDAS puntua (legacy, not live path)", () => {
  it("scores each round type with expected feedback", () => {
    const cases = [
      { utterance: APERTURA_UTTERANCE, round: "apertura" as const },
      { utterance: OBJECION_UTTERANCE, round: "objecion" as const },
      { utterance: CLARIDAD_UTTERANCE, round: "claridad" as const },
      { utterance: CORREO_UTTERANCE, round: "correo" as const },
    ];

    for (const testCase of cases) {
      const analisis = analizar(testCase.utterance);
      const result = puntua(testCase.round, analisis, 2);
      expect(result.roundScore).toBeGreaterThan(0);
      expect(result.feedback).toBeTruthy();
      expect(["bien", "medio", "mal"]).toContain(result.reaction);
      expect(result.won).toBe(false);
    }
  });
});

describe("live turn scoring (no keyword formula)", () => {
  it("returns analytics chips instead of keyword hits", async () => {
    const result = await scoreLiveTurn({
      utterance:
        "Entiendo su reto. ¿Qué le cuesta más hoy la baja retención y qué ha probado?",
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: "Discovery",
      difficultyLevel: 2,
      scenarioSlug: "custom-gym",
      isPreset: false,
      config: null,
      clientName: "Carlos",
      isLastRound: false,
      priorLines: [{ role: "client", text: "¿Quién habla?" }],
    });

    expect(result.analytics.questionTypes.open).toBeGreaterThan(0);
    expect(result.coaching.note.length).toBeGreaterThan(10);
    expect(result.engagementScore).toBeGreaterThan(0);
  });
});

describe("SPIN Advance outcomes", () => {
  it("wins with concrete next action", () => {
    expect(
      evaluateAdvanceOutcome(
        GOOD_CLOSE_UTTERANCE,
        "SPIN Advance: siguiente acción concreta",
      ),
    ).toBe(true);
  });

  it("fails vague close without concrete action", () => {
    expect(
      evaluateAdvanceOutcome(
        FAIL_CLOSE_UTTERANCE,
        "SPIN Advance: siguiente acción concreta",
      ),
    ).toBe(false);
  });

  it("allows day-only phrasing when paired with concrete action verb", () => {
    expect(
      evaluateAdvanceOutcome(
        LEVEL1_CLOSE_DAY_ONLY,
        "SPIN Advance: siguiente acción concreta",
      ),
    ).toBe(true);
  });
});

describe("scoring extension point", () => {
  it("detects concrete day and time in Spanish", () => {
    expect(
      detectConcreteDayAndTime(
        "¿Le parece el martes 15 a las 10:30 para la reunión?",
      ),
    ).toBe(true);
    expect(detectConcreteDayAndTime("¿Podemos agendar algo?")).toBe(false);
  });

  it("scoreUtterance delegates to legacy path when slug omitted", () => {
    const result = scoreUtterance({
      utterance: "Entiendo el problema de medición y propongo una reunión",
      roundType: "apertura",
    });
    expect(result.roundScore).toBeGreaterThan(0);
  });
});
