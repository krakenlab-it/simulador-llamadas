import type { DifficultyLevel, PracticeMode, RoundType } from "@/lib/db/types";
import { ROUND_ORDER } from "@/lib/db/types";

/**
 * Session extension point — call lifecycle + Web Speech API (browser).
 * Production UI will mirror docs/prototype UX; persistence goes server-side.
 */

export interface SessionConfig {
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
}

export interface SessionState {
  callAttemptId: string | null;
  currentRound: number;
  rounds: RoundType[];
  isActive: boolean;
}

export function createInitialSessionState(): SessionState {
  return {
    callAttemptId: null,
    currentRound: 1,
    rounds: [...ROUND_ORDER],
    isActive: false,
  };
}

export function getRoundTypeForNumber(roundNumber: number): RoundType | null {
  const index = roundNumber - 1;
  if (index < 0 || index >= ROUND_ORDER.length) {
    return null;
  }
  return ROUND_ORDER[index];
}

/**
 * Web Speech API is browser-only. Guard usage in client components.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "speechSynthesis" in window;
}
