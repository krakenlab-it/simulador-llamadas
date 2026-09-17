import { describe, expect, it } from "vitest";
import { utteranceHasDay, utteranceHasTime } from "@/lib/session/win";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { getClientReply } from "@/lib/scoring/reactions";

const SPANISH_CLOSE_UTTERANCE =
  "puedes próxima semana el martes a las 10 de la mañana";

describe("utteranceHasDay / utteranceHasTime", () => {
  it("detects weekday and Spanish clock phrases in scheduling proposals", () => {
    expect(utteranceHasDay(SPANISH_CLOSE_UTTERANCE)).toBe(true);
    expect(utteranceHasTime(SPANISH_CLOSE_UTTERANCE)).toBe(true);
  });

  it.each([
    "a las 10",
    "10 de la mañana",
    "10 de la tarde",
    "10 de la noche",
    "10am",
    "10:00",
  ])("detects time phrase: %s", (phrase) => {
    expect(utteranceHasTime(`el martes ${phrase}`)).toBe(true);
  });
});

describe("scoreLiveTurn cierre scheduling", () => {
  it("does not loop mal when trainee proposes concrete day and time on cierre", async () => {
    const sessionSeed = "utterance-schedule-cierre";
    const result = await scoreLiveTurn({
      utterance: SPANISH_CLOSE_UTTERANCE,
      roundKey: "cierre",
      roundType: "cierre",
      roundLabel: "Cierre",
      roundGoal: "",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config: null,
      clientName: "Mariana",
      isLastRound: true,
      sessionSeed,
      priorLines: [],
    });

    expect(result.clientReaction).not.toBe("mal");
    expect(result.clientReply).not.toBe(
      getClientReply("mariana", "cierre", "mal", { sessionSeed }),
    );
    expect(result.clientReaction).toBe("bien");
    expect(result.clientReply).toBe(
      getClientReply("mariana", "cierre", "bien", { sessionSeed }),
    );
  });
});
