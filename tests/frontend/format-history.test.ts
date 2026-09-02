import { describe, expect, it } from "vitest";
import { formatHistoryEntry } from "@/lib/frontend/format-history";
import type { HistoryListItem } from "@/lib/frontend/format-history";

describe("format history", () => {
  const entry: HistoryListItem = {
    callAttemptId: "stub-abc",
    clientName: "Mariana Escobedo",
    difficultyLevel: 2,
    mode: "texto",
    won: true,
    totalScore: 78,
    turnsCompleted: 5,
    startedAt: "2026-03-01T14:30:00.000Z",
    durationSeconds: 200,
  };

  it("formats Spanish labels for a scored call", () => {
    const row = formatHistoryEntry(entry);
    expect(row.id).toBe("stub-abc");
    expect(row.clientName).toBe("Mariana Escobedo");
    expect(row.difficultyLabel).toBe("Nivel 2");
    expect(row.modeLabel).toBe("Texto");
    expect(row.scoreLabel).toBe("78/100");
    expect(row.turnsLabel).toBe("5 turnos");
    expect(row.durationLabel).toBe("3 min 20 s");
    expect(row.outcomeLabel).toBe("Advance");
    expect(row.outcomeTone).toBe("won");
    expect(row.when).toMatch(/\d/);
  });

  it("marks continuation calls with neutral tone", () => {
    const row = formatHistoryEntry({ ...entry, won: false, totalScore: null });
    expect(row.outcomeLabel).toBe("Continuation");
    expect(row.outcomeTone).toBe("lost");
    expect(row.scoreLabel).toBe("—");
  });
});
