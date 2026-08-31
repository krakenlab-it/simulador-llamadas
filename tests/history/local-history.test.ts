import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLocalHistory,
  clearLocalHistory,
  computeLocalTrend,
  loadLocalHistory,
  type LocalHistoryEntry,
} from "@/lib/history/local";

const sample = (overrides: Partial<LocalHistoryEntry> = {}): LocalHistoryEntry => ({
  callAttemptId: "call-1",
  scenarioSlug: "mariana",
  clientName: "Mariana",
  difficultyLevel: 1,
  mode: "texto",
  won: false,
  totalScore: 70,
  turnsCompleted: 3,
  startedAt: "2025-08-31T12:00:00.000Z",
  ...overrides,
});

describe("local history (no-auth demo)", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
    clearLocalHistory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty", () => {
    expect(loadLocalHistory()).toEqual([]);
  });

  it("appends and dedupes by callAttemptId", () => {
    appendLocalHistory(sample({ callAttemptId: "a", totalScore: 60 }));
    appendLocalHistory(sample({ callAttemptId: "b", totalScore: 80 }));
    appendLocalHistory(sample({ callAttemptId: "a", totalScore: 90 }));

    const history = loadLocalHistory();
    expect(history).toHaveLength(2);
    expect(history[0].callAttemptId).toBe("a");
    expect(history[0].totalScore).toBe(90);
    expect(history[1].callAttemptId).toBe("b");
  });

  it("computes trend for a scenario slug", () => {
    appendLocalHistory(sample({ scenarioSlug: "mariana", totalScore: 60 }));
    appendLocalHistory(
      sample({
        callAttemptId: "call-2",
        scenarioSlug: "mariana",
        totalScore: 80,
        startedAt: "2025-08-31T13:00:00.000Z",
      }),
    );

    const trend = computeLocalTrend("mariana");
    expect(trend).toEqual({
      attempts: 2,
      averageScore: 70,
      improving: true,
    });
    expect(computeLocalTrend("rodrigo")).toBeNull();
  });
});
