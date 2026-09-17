import type { RoundType } from "@/lib/db/types";
import type { ScenarioConfig } from "@/lib/scenarios/types";
import { evaluateAdvanceOutcome, resolveWinCriteria } from "@/lib/scoring/outcome";
import {
  utteranceHasConcreteDayAndTime,
  utteranceHasDay,
  utteranceHasTime,
} from "@/lib/scoring/keywords";

export interface EndSessionTurnInput {
  roundType: RoundType | null;
  roundKey: string | null;
  traineeUtterance: string | null;
}

/**
 * Session-level win at hang-up. Uses SPIN Advance (or custom winCriteria),
 * not reunion+weekday keyword regex.
 */
export function resolveEndSessionWin(
  options: {
    isPreset: boolean;
    closeRoundKey: string | null;
    config: ScenarioConfig | null;
  },
  turns: EndSessionTurnInput[],
): boolean {
  if (turns.length === 0) {
    return false;
  }

  let closeTurn: EndSessionTurnInput | undefined;

  if (options.isPreset) {
    closeTurn = turns.find((turn) => turn.roundType === "cierre");
    if (!closeTurn) {
      return false;
    }
  } else {
    const lastTurn = turns[turns.length - 1];
    const closeKeys = new Set(
      ["cierre", options.closeRoundKey].filter((key): key is string => Boolean(key)),
    );
    if (!lastTurn.roundKey || !closeKeys.has(lastTurn.roundKey)) {
      return false;
    }
    closeTurn = lastTurn;
  }

  const fullTraineeText = turns
    .map((t) => t.traineeUtterance ?? "")
    .filter(Boolean)
    .join("\n");

  return evaluateAdvanceOutcome(fullTraineeText, resolveWinCriteria(options.config));
}

/** @deprecated Keyword-based close win removed in KLM-50. */
export function evaluateCloseWinFromScore(): boolean {
  return false;
}

export { utteranceHasConcreteDayAndTime, utteranceHasDay, utteranceHasTime };
