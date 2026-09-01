import {
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_TTS_MAX_CHARS_PER_TURN,
} from "@/lib/voice/brakes";
import type { VoiceSessionUsageRow } from "@/lib/voice/usage";

/** True when the line is worth sending to billed TTS (patient speech, not UI noise). */
export function isSpeakableTtsText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
}

export type BilledTtsTextPrep = {
  requestedChars: number;
  spokenText: string;
  sentChars: number;
};

/**
 * Shorten text before ElevenLabs billing. The full client reply stays in the
 * transcript for scoring; only the spoken clip is capped per turn.
 */
export function truncateForBilledTts(
  text: string,
  maxChars: number = SESSION_TTS_MAX_CHARS_PER_TURN,
): BilledTtsTextPrep {
  const trimmed = text.trim();
  const requestedChars = trimmed.length;
  if (trimmed.length <= maxChars) {
    return { requestedChars, spokenText: trimmed, sentChars: trimmed.length };
  }

  const slice = trimmed.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("… "),
  );
  if (sentenceEnd > maxChars * 0.5) {
    const spokenText = trimmed.slice(0, sentenceEnd + 1).trim();
    return { requestedChars, spokenText, sentChars: spokenText.length };
  }

  const lastSpace = slice.lastIndexOf(" ");
  const spokenText = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
  return { requestedChars, spokenText, sentChars: spokenText.length };
}

export function sessionExtraTtsRemainingChars(usage: VoiceSessionUsageRow): number {
  return Math.max(0, SESSION_EXTRA_TTS_MAX_CHARS - usage.extraTtsCharsUsed);
}
