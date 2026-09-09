import type { SessionMemory, TurnLogEntry } from "./types";

export function createSessionMemory(sessionId: string): SessionMemory {
  return { sessionId, turns: [] };
}

export function appendTurn(
  memory: SessionMemory,
  entry: Omit<TurnLogEntry, "timestamp"> & { timestamp?: string },
): SessionMemory {
  return {
    ...memory,
    turns: [
      ...memory.turns,
      {
        ...entry,
        timestamp: entry.timestamp ?? new Date().toISOString(),
      },
    ],
  };
}

export function getRecentTurns(
  memory: SessionMemory,
  limit = 6,
): TurnLogEntry[] {
  return memory.turns.slice(-limit);
}

export function formatTurnLog(memory: SessionMemory): string {
  return memory.turns
    .map((turn) => `[${turn.role}] ${turn.text}`)
    .join("\n");
}

/** Browser-only persistence key prefix for optional turn logs. */
export const SESSION_MEMORY_KEY_PREFIX = "agenticTurnLog:";

export function loadSessionMemoryFromStorage(
  sessionId: string,
): SessionMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${SESSION_MEMORY_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionMemory;
  } catch {
    return null;
  }
}

export function saveSessionMemoryToStorage(memory: SessionMemory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${SESSION_MEMORY_KEY_PREFIX}${memory.sessionId}`,
      JSON.stringify(memory),
    );
  } catch {
    // Ignore quota errors in demo mode.
  }
}
