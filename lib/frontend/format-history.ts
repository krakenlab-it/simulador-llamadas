import type { LocalHistoryEntry } from "@/lib/history/local";
import { MODE_LABELS } from "@/lib/frontend/training-readiness";

export interface FormattedHistoryRow {
  id: string;
  when: string;
  clientName: string;
  difficultyLabel: string;
  modeLabel: string;
  scoreLabel: string;
  outcomeLabel: string;
  outcomeTone: "won" | "lost";
}

export function formatHistoryEntry(entry: LocalHistoryEntry): FormattedHistoryRow {
  const when = new Date(entry.startedAt).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    id: entry.callAttemptId,
    when,
    clientName: entry.clientName,
    difficultyLabel: `Nivel ${entry.difficultyLevel}`,
    modeLabel: MODE_LABELS[entry.mode],
    scoreLabel: `${entry.totalScore} pts`,
    outcomeLabel: entry.won ? "Objetivo logrado" : "Sin cierre",
    outcomeTone: entry.won ? "won" : "lost",
  };
}

export function formatHistoryEntries(
  entries: LocalHistoryEntry[],
): FormattedHistoryRow[] {
  return entries.map(formatHistoryEntry);
}
