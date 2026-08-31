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
import { scoreTurn } from "@/lib/scoring";
import {
  detectConcreteDayAndTime,
  scoreUtterance,
} from "@/lib/extension-points/scoring";

describe("analizar()", () => {
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

  it("flags telegrama on very short utterances", () => {
    const result = analizar("Hola");
    expect(result.hits.telegrama).toBe(true);
  });

  it("flags descalifica and gratis when present", () => {
    const result = analizar("Esto es gratis y no califica para usted");
    expect(result.hits.gratis).toBe(true);
    expect(result.hits.descalifica).toBe(true);
  });
});

describe("RONDAS puntua", () => {
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

describe("scoring fixtures — close outcomes", () => {
  it("wins with concrete day and time on nivel 2+", () => {
    const result = scoreTurn({
      utterance: GOOD_CLOSE_UTTERANCE,
      roundType: "cierre",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
    });

    expect(result.keywordHits.reunion).toBe(true);
    expect(result.hasDay).toBe(true);
    expect(result.hasTime).toBe(true);
    expect(result.hasConcreteDayAndTime).toBe(true);
    expect(result.won).toBe(true);
    expect(result.clientReaction).toBe("bien");
    expect(result.clientReply).toContain("agendo");
  });

  it("fails close without concrete day and time on nivel 2+", () => {
    const result = scoreTurn({
      utterance: FAIL_CLOSE_UTTERANCE,
      roundType: "cierre",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
    });

    expect(result.won).toBe(false);
    expect(result.hasConcreteDayAndTime).toBe(false);
    expect(["medio", "mal"]).toContain(result.clientReaction);
  });

  it("allows day-only close on nivel 1", () => {
    const result = scoreTurn({
      utterance: LEVEL1_CLOSE_DAY_ONLY,
      roundType: "cierre",
      difficultyLevel: 1,
      scenarioSlug: "efrain",
    });

    expect(result.keywordHits.reunion).toBe(true);
    expect(result.hasDay).toBe(true);
    expect(result.won).toBe(true);
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

  it("returns keyword hits via scoreUtterance", () => {
    const result = scoreUtterance({
      utterance: "Entiendo el problema de medición y propongo una reunión",
      roundType: "apertura",
    });
    expect(result.keywordHits.problema).toBe(true);
    expect(result.roundScore).toBeGreaterThan(0);
  });
});
