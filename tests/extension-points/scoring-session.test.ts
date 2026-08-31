import { describe, expect, it } from "vitest";
import {
  detectConcreteDayAndTime,
  scoreUtterancePlaceholder,
} from "@/lib/extension-points/scoring";
import {
  createInitialSessionState,
  getRoundTypeForNumber,
} from "@/lib/extension-points/session";
import { ROUND_ORDER } from "@/lib/db/types";

describe("scoring extension point", () => {
  it("detects concrete day and time in Spanish", () => {
    expect(
      detectConcreteDayAndTime(
        "¿Le parece el martes 15 a las 10:30 para la reunión?",
      ),
    ).toBe(true);
    expect(detectConcreteDayAndTime("¿Podemos agendar algo?")).toBe(false);
  });

  it("returns keyword hits placeholder", () => {
    const result = scoreUtterancePlaceholder({
      utterance: "Entiendo el problema de medición y propongo una reunión",
      roundType: "apertura",
    });
    expect(result.keywordHits.problema).toBe(true);
    expect(result.roundScore).toBeGreaterThan(0);
  });
});

describe("session extension point", () => {
  it("tracks five rounds in order", () => {
    const state = createInitialSessionState();
    expect(state.rounds).toEqual([...ROUND_ORDER]);
    expect(getRoundTypeForNumber(1)).toBe("apertura");
    expect(getRoundTypeForNumber(5)).toBe("cierre");
    expect(getRoundTypeForNumber(6)).toBeNull();
  });
});
