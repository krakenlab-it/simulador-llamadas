import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { MODE_LABELS } from "@/lib/frontend/training-readiness";
import { formatDurationLabel } from "@/lib/session/duration";

export interface HistoryListItem {
  callAttemptId: string;
  clientName: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  won: boolean | null;
  totalScore: number | null;
  turnsCompleted: number;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
}

export interface FormattedHistoryRow {
  id: string;
  when: string;
  clientName: string;
  difficultyLabel: string;
  modeLabel: string;
  scoreLabel: string;
  turnsLabel: string;
  durationLabel: string;
  outcomeLabel: string;
  outcomeTone: "won" | "lost";
}

export function formatHistoryEntry(entry: HistoryListItem): FormattedHistoryRow {
  const when = new Date(entry.startedAt).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const score =
    entry.totalScore == null ? "—" : `${Math.round(entry.totalScore)}/100`;

  return {
    id: entry.callAttemptId,
    when,
    clientName: entry.clientName,
    difficultyLabel: `Nivel ${entry.difficultyLevel}`,
    modeLabel: MODE_LABELS[entry.mode],
    scoreLabel: score,
    turnsLabel: `${entry.turnsCompleted} ${entry.turnsCompleted === 1 ? "turno" : "turnos"}`,
    durationLabel: formatDurationLabel(entry.durationSeconds),
    outcomeLabel: entry.won ? "Advance" : "Continuation",
    outcomeTone: entry.won ? "won" : "lost",
  };
}

export function formatHistoryEntries(
  entries: HistoryListItem[],
): FormattedHistoryRow[] {
  return entries.map(formatHistoryEntry);
}
