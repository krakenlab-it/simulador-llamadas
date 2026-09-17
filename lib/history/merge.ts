import type { HistoryEntry } from "@/lib/api/stubs";
import type { LocalHistoryEntry } from "./local";

export function localEntryToHistoryEntry(entry: LocalHistoryEntry): HistoryEntry {
  return {
    callAttemptId: entry.callAttemptId,
    traineeId: "local",
    scenarioSlug: entry.scenarioSlug,
    clientName: entry.clientName,
    difficultyLevel: entry.difficultyLevel,
    mode: entry.mode,
    status: "completed",
    won: entry.won,
    totalScore: entry.totalScore,
    startedAt: entry.startedAt,
    endedAt: null,
    durationSeconds: entry.durationSeconds ?? null,
    turnsCompleted: entry.turnsCompleted,
  };
}

export function mergeHistoryEntries(...lists: HistoryEntry[][]): HistoryEntry[] {
  const byId = new Map<string, HistoryEntry>();

  for (const list of lists) {
    for (const entry of list) {
      if (!byId.has(entry.callAttemptId)) {
        byId.set(entry.callAttemptId, entry);
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function completedHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter((entry) => entry.status === "completed");
}
