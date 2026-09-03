import { describe, expect, it } from "vitest";
import type { CallAnalytics } from "@/lib/scoring/types";
import {
  TURN_FEEDBACK_AUTO_COLLAPSE_MS,
  appendTurnFeedback,
  autoCollapseIfUntouched,
  toggleTurnFeedback,
  type TurnFeedbackEntry,
} from "@/lib/call/turn-feedback";

const ANALYTICS: CallAnalytics = {
  talkPercent: 40,
  longestMonologueSeconds: 8,
  questionTypes: { open: 1, closed: 0, clarifying: 0 },
  patienceAfterBuyerTurnSeconds: 2,
  hasNextStep: false,
};

function entry(
  overrides: Partial<TurnFeedbackEntry> & Pick<TurnFeedbackEntry, "id" | "whyScore">,
): Omit<TurnFeedbackEntry, "collapsed" | "touched"> {
  return {
    turnIndex: 1,
    roundLabel: "Apertura",
    strongerLine: "Menciona la métrica.",
    score: 70,
    analytics: ANALYTICS,
    ...overrides,
  };
}

describe("per-turn coaching history", () => {
  it("keeps auto-collapse at about eight seconds", () => {
    expect(TURN_FEEDBACK_AUTO_COLLAPSE_MS).toBe(8000);
  });

  it("appends the latest turn without dropping earlier coaching", () => {
    const first = appendTurnFeedback([], entry({ id: "t1", whyScore: "Nombraste el problema." }));
    const next = appendTurnFeedback(
      first,
      entry({
        id: "t2",
        turnIndex: 2,
        roundLabel: "Objeción",
        whyScore: "Pediste la métrica.",
      }),
    );

    expect(next).toHaveLength(2);
    expect(next[0]?.whyScore).toBe("Nombraste el problema.");
    expect(next[1]?.whyScore).toBe("Pediste la métrica.");
    expect(next[1]?.collapsed).toBe(false);
  });

  it("auto-collapse only folds an untouched card and never deletes history", () => {
    const history = appendTurnFeedback(
      appendTurnFeedback([], entry({ id: "t1", whyScore: "Primero." })),
      entry({ id: "t2", turnIndex: 2, whyScore: "Segundo." }),
    );
    const trainerClosedFirst = toggleTurnFeedback(history, "t1");
    const collapsed = autoCollapseIfUntouched(trainerClosedFirst, "t2");

    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]?.whyScore).toBe("Primero.");
    expect(collapsed[0]?.collapsed).toBe(true);
    expect(collapsed[0]?.touched).toBe(true);
    expect(collapsed[1]?.whyScore).toBe("Segundo.");
    expect(collapsed[1]?.collapsed).toBe(true);
    expect(collapsed[1]?.touched).toBe(false);
  });

  it("does not auto-collapse a card the trainer already opened or closed", () => {
    const history = appendTurnFeedback([], entry({ id: "t1", whyScore: "Sigue abierta." }));
    const touched = toggleTurnFeedback(toggleTurnFeedback(history, "t1"), "t1");
    const afterTimer = autoCollapseIfUntouched(touched, "t1");

    expect(afterTimer[0]?.collapsed).toBe(false);
    expect(afterTimer[0]?.touched).toBe(true);
    expect(afterTimer[0]?.whyScore).toBe("Sigue abierta.");
  });
});
