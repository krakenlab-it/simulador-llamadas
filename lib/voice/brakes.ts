/** Locked spend-brake units (Ilya sign-off). Count seconds/chars only — no dollar meter. */

/** Kill switch: when false, billed ElevenLabs path is skipped entirely. */
export function isElevenLabsEnabled(): boolean {
  const raw = process.env.ELEVENLABS_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

/** Per billed session: ConvAI wall-clock hard stop (seconds). */
export const SESSION_CONVAI_MAX_SECONDS = 180;

/** Warn trainee when this many seconds remain in the session ConvAI budget. */
export const SESSION_CONVAI_WARN_REMAINING_SECONDS = 30;

/** Clinic scoring phases shown in the UI (apertura → cierre). */
export const SESSION_MAX_ROUNDS = 5;

/**
 * Safety cap on trainee messages per call. Must exceed SESSION_MAX_ROUNDS so
 * follow-up lines after the fifth phase are not rejected with 409.
 */
export const SESSION_MAX_TURN_ALLOCATIONS = 15;

/** Extra streaming TTS outside ConvAI, per billed session (characters). */
export const SESSION_EXTRA_TTS_MAX_CHARS = 2500;

/** Public URL: exactly one billed ConvAI session per user per UTC day (not 3, not 540s). */
export const DAILY_BILLED_SESSIONS_PER_USER = 1;

/**
 * ConvAI wall-clock below this does not consume the daily billed slot (failed
 * connect storms, slot acquire without audible agent, etc.).
 */
export const MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT = 5;

/** Global concurrent ConvAI sessions. Third caller falls back to Web Speech. */
export const GLOBAL_MAX_CONCURRENT_CONVAI = 2;

/** Global monthly ConvAI budget (minutes → seconds counter). */
export const GLOBAL_MONTHLY_CONVAI_MINUTES = 300;
export const GLOBAL_MONTHLY_CONVAI_MAX_SECONDS =
  GLOBAL_MONTHLY_CONVAI_MINUTES * 60;
