/**
 * Device-local call history for the no-auth demo.
 * Stored in localStorage on this browser only — not login, not accounts.
 */

import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";

const LOCAL_HISTORY_KEY = "simulador:localHistory";

export interface LocalHistoryEntry {
  callAttemptId: string;
  scenarioSlug: string;
  clientName: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  won: boolean;
  totalScore: number;
  turnsCompleted: number;
  startedAt: string;
}

export interface LocalHistoryTrend {
  attempts: number;
  averageScore: number;
  improving: boolean;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadLocalHistory(): LocalHistoryEntry[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendLocalHistory(entry: LocalHistoryEntry): void {
  if (!canUseLocalStorage()) return;
  const existing = loadLocalHistory();
  const next = [entry, ...existing.filter((e) => e.callAttemptId !== entry.callAttemptId)].slice(
    0,
    50,
  );
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
}

export function computeLocalTrend(
  scenarioSlug: string,
  history: LocalHistoryEntry[] = loadLocalHistory(),
): LocalHistoryTrend | null {
  const forScenario = history.filter((e) => e.scenarioSlug === scenarioSlug);
  if (forScenario.length === 0) return null;

  const scores = forScenario.map((e) => e.totalScore);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const improving =
    forScenario.length > 1
      ? forScenario[0].totalScore > forScenario[forScenario.length - 1].totalScore
      : false;

  return {
    attempts: forScenario.length,
    averageScore: Math.round(averageScore * 100) / 100,
    improving,
  };
}

/** Test helper */
export function clearLocalHistory(): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(LOCAL_HISTORY_KEY);
}
