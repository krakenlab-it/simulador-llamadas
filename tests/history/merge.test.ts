import { describe, expect, it } from "vitest";
import {
  completedHistoryEntries,
  localEntryToHistoryEntry,
  mergeHistoryEntries,
} from "@/lib/history/merge";
import type { LocalHistoryEntry } from "@/lib/history/local";

describe("history merge helpers", () => {
  it("converts local entries to completed history rows", () => {
    const local: LocalHistoryEntry = {
      callAttemptId: "ca-1",
      scenarioSlug: "mariana",
      clientName: "Mariana Escobedo",
      difficultyLevel: 1,
      mode: "texto",
      won: true,
      totalScore: 80,
      turnsCompleted: 5,
      startedAt: "2026-09-01T10:00:00.000Z",
    };

    const entry = localEntryToHistoryEntry(local);
    expect(entry.status).toBe("completed");
    expect(entry.clientName).toBe("Mariana Escobedo");
  });

  it("merges lists without duplicate callAttemptIds", () => {
    const merged = mergeHistoryEntries(
      [
        {
          callAttemptId: "a",
          traineeId: "local",
          scenarioSlug: "mariana",
          clientName: "Local first",
          difficultyLevel: 1,
          mode: "texto",
          status: "completed",
          won: true,
          totalScore: 70,
          startedAt: "2026-09-02T10:00:00.000Z",
          endedAt: null,
          durationSeconds: 60,
          turnsCompleted: 5,
        },
      ],
      [
        {
          callAttemptId: "a",
          traineeId: "tr-1",
          scenarioSlug: "mariana",
          clientName: "Server duplicate",
          difficultyLevel: 1,
          mode: "texto",
          status: "completed",
          won: false,
          totalScore: 50,
          startedAt: "2026-09-01T10:00:00.000Z",
          endedAt: null,
          durationSeconds: 60,
          turnsCompleted: 5,
        },
        {
          callAttemptId: "b",
          traineeId: "tr-1",
          scenarioSlug: "rodrigo",
          clientName: "Rodrigo Nava",
          difficultyLevel: 2,
          mode: "texto",
          status: "completed",
          won: false,
          totalScore: 55,
          startedAt: "2026-09-03T10:00:00.000Z",
          endedAt: null,
          durationSeconds: 60,
          turnsCompleted: 5,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].callAttemptId).toBe("b");
    expect(merged.find((entry) => entry.callAttemptId === "a")?.clientName).toBe(
      "Local first",
    );
  });

  it("filters non-completed rows", () => {
    const completed = completedHistoryEntries([
      {
        callAttemptId: "done",
        traineeId: "tr-1",
        scenarioSlug: "mariana",
        clientName: "Done",
        difficultyLevel: 1,
        mode: "texto",
        status: "completed",
        won: true,
        totalScore: 80,
        startedAt: "2026-09-01T10:00:00.000Z",
        endedAt: null,
        durationSeconds: 60,
        turnsCompleted: 5,
      },
      {
        callAttemptId: "open",
        traineeId: "tr-1",
        scenarioSlug: "mariana",
        clientName: "Open",
        difficultyLevel: 1,
        mode: "texto",
        status: "in_progress",
        won: null,
        totalScore: null,
        startedAt: "2026-09-02T10:00:00.000Z",
        endedAt: null,
        durationSeconds: null,
        turnsCompleted: 1,
      },
    ]);

    expect(completed).toHaveLength(1);
    expect(completed[0].callAttemptId).toBe("done");
  });
});
