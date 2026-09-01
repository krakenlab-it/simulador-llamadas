import { describe, expect, it } from "vitest";
import { GOOD_CLOSE_UTTERANCE } from "../fixtures/scoring/utterances";
import { resolveEndSessionWin } from "@/lib/session/win";

describe("resolveEndSessionWin", () => {
  it("does not award a clinic win when hanging up before cierre", () => {
    const won = resolveEndSessionWin(
      { isPreset: true, closeRoundKey: "cierre", config: null },
      [
        {
          roundType: "apertura",
          roundKey: "apertura",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
        },
      ],
    );

    expect(won).toBe(false);
  });

  it("awards a clinic win only on the cierre turn with SPIN Advance", () => {
    const won = resolveEndSessionWin(
      { isPreset: true, closeRoundKey: "cierre", config: null },
      [
        {
          roundType: "correo",
          roundKey: "correo",
          traineeUtterance: "Le envío un correo para reunión.",
        },
        {
          roundType: "cierre",
          roundKey: "cierre",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
        },
      ],
    );

    expect(won).toBe(true);
  });

  it("does not award a custom win when the last turn is not the close round", () => {
    const won = resolveEndSessionWin(
      { isPreset: false, closeRoundKey: "cierre", config: null },
      [
        {
          roundType: null,
          roundKey: "apertura",
          traineeUtterance: GOOD_CLOSE_UTTERANCE,
        },
      ],
    );

    expect(won).toBe(false);
  });
});
