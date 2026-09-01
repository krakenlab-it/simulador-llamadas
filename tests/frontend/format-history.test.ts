import { describe, expect, it } from "vitest";
import { formatHistoryEntry } from "@/lib/frontend/format-history";
import type { LocalHistoryEntry } from "@/lib/history/local";

describe("format history", () => {
  const entry: LocalHistoryEntry = {
    callAttemptId: "stub-abc",
    scenarioSlug: "mariana",
    clientName: "Mariana Escobedo",
    difficultyLevel: 2,
    mode: "texto",
    won: true,
    totalScore: 78,
    turnsCompleted: 5,
    startedAt: "2026-03-01T14:30:00.000Z",
  };

  it("formats Spanish labels for a won call", () => {
    const row = formatHistoryEntry(entry);
    expect(row.id).toBe("stub-abc");
    expect(row.clientName).toBe("Mariana Escobedo");
    expect(row.difficultyLabel).toBe("Nivel 2");
    expect(row.modeLabel).toBe("Texto");
    expect(row.scoreLabel).toBe("78 pts");
    expect(row.outcomeLabel).toBe("Objetivo logrado");
    expect(row.outcomeTone).toBe("won");
    expect(row.when).toMatch(/\d/);
  });

  it("marks lost calls with neutral tone", () => {
    const row = formatHistoryEntry({ ...entry, won: false });
    expect(row.outcomeLabel).toBe("Sin cierre");
    expect(row.outcomeTone).toBe("lost");
  });
});
