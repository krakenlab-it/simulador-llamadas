import type { DifficultyLevel } from "@/lib/db/types";
import type { AgenticSessionState } from "./types";
import { initialEmotionalMeters } from "./emotional-meters";

const store = new Map<string, AgenticSessionState>();

export function getAgenticSessionState(
  callAttemptId: string,
  difficultyLevel: DifficultyLevel,
): AgenticSessionState {
  const existing = store.get(callAttemptId);
  if (existing) return existing;

  const created: AgenticSessionState = {
    callAttemptId,
    mode: "cliente",
    meters: initialEmotionalMeters(difficultyLevel),
    turnNumber: 0,
  };
  store.set(callAttemptId, created);
  return created;
}

export function saveAgenticSessionState(state: AgenticSessionState): void {
  store.set(state.callAttemptId, state);
}

export function resetAgenticSessionState(
  callAttemptId: string,
  difficultyLevel: DifficultyLevel,
): AgenticSessionState {
  const reset: AgenticSessionState = {
    callAttemptId,
    mode: "cliente",
    meters: initialEmotionalMeters(difficultyLevel),
    turnNumber: 0,
  };
  store.set(callAttemptId, reset);
  return reset;
}

export function clearAgenticSessionState(callAttemptId: string): void {
  store.delete(callAttemptId);
}

/** Test helper */
export function clearAllAgenticSessionStates(): void {
  store.clear();
}
