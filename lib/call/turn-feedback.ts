import type { CallAnalytics } from "@/lib/scoring/types";

/** Time an untouched coaching card stays expanded before it folds into a strip. */
export const TURN_FEEDBACK_AUTO_COLLAPSE_MS = 8000;

export interface TurnFeedbackEntry {
  id: string;
  turnIndex: number;
  roundLabel: string;
  whyScore: string;
  strongerLine: string;
  score: number;
  analytics: CallAnalytics | null;
  collapsed: boolean;
  touched: boolean;
}

export function appendTurnFeedback(
  history: readonly TurnFeedbackEntry[],
  incoming: Omit<TurnFeedbackEntry, "collapsed" | "touched">,
): TurnFeedbackEntry[] {
  return [
    ...history,
    {
      ...incoming,
      collapsed: false,
      touched: false,
    },
  ];
}

export function toggleTurnFeedback(
  history: readonly TurnFeedbackEntry[],
  id: string,
): TurnFeedbackEntry[] {
  return history.map((entry) =>
    entry.id === id
      ? { ...entry, collapsed: !entry.collapsed, touched: true }
      : entry,
  );
}

export function autoCollapseIfUntouched(
  history: readonly TurnFeedbackEntry[],
  id: string,
): TurnFeedbackEntry[] {
  return history.map((entry) => {
    if (entry.id !== id || entry.touched || entry.collapsed) return entry;
    return { ...entry, collapsed: true };
  });
}
