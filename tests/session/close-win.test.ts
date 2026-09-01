import { describe, expect, it } from "vitest";
import { GOOD_CLOSE_UTTERANCE } from "../fixtures/scoring/utterances";
import { scoreUtterance } from "@/lib/extension-points/scoring";
import { resolveEndSessionWin } from "@/lib/session";

describe("resolveEndSessionWin", () => {
  it("does not award a clinic win when hanging up before cierre", () => {
    const aperturaScore = scoreUtterance({
      utterance: GOOD_CLOSE_UTTERANCE,
      roundType: "apertura",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
    });

    const won = resolveEndSessionWin(
      { isPreset: true, difficultyLevel: 2, closeRoundKey: "cierre" },
      [
        {
          roundType: "apertura",
          roundKey: "apertura",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
          keywordHits: aperturaScore.keywordHits,
        },
      ],
    );

    expect(won).toBe(false);
  });

  it("awards a clinic win only on the cierre turn", () => {
    const cierreScore = scoreUtterance({
      utterance: GOOD_CLOSE_UTTERANCE,
      roundType: "cierre",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
    });

    const won = resolveEndSessionWin(
      { isPreset: true, difficultyLevel: 2, closeRoundKey: "cierre" },
      [
        {
          roundType: "correo",
          roundKey: "correo",
          traineeUtterance: "Le envío un correo para reunión.",
          keywordHits: { reunion: true },
        },
        {
          roundType: "cierre",
          roundKey: "cierre",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
          keywordHits: cierreScore.keywordHits,
        },
      ],
    );

    expect(won).toBe(true);
  });

  it("does not award a custom win when the last turn is not the close round", () => {
    const won = resolveEndSessionWin(
      { isPreset: false, difficultyLevel: 2, closeRoundKey: "cierre" },
      [
        {
          roundType: null,
          roundKey: "apertura",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
          keywordHits: { reunion: true, dia_hora: true },
        },
      ],
    );

    expect(won).toBe(false);
  });
});
