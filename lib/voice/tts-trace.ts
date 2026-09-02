import { randomUUID } from "node:crypto";
import { ELEVENLABS_DEFAULT_PREMADE_VOICE } from "@/lib/voice/providers/elevenlabs";
import { redactSecrets } from "@/lib/voice/provider-result";

export type VoiceIdCategory = "library" | "premade";

/** Context carried from the route into each billed ElevenLabs HTTP attempt. */
export interface TtsTraceContext {
  requestId: string;
  sessionUsageId?: string;
  turnId?: string;
  charsRequested: number;
  charsSent: number;
  sessionExtraTtsRemaining: number | null;
  /** ISO 639-1 requested for this billed attempt (clinic: es). */
  languageCode?: string;
}

export interface TtsAttemptLog {
  event: "voice.tts.attempt";
  requestId: string;
  sessionUsageId?: string;
  turnId?: string;
  voiceIdCategory: VoiceIdCategory;
  endpoint?: string;
  httpStatus?: number;
  elevenlabsErrorCode?: string;
  failureReason?: string;
  charsRequested: number;
  charsSent: number;
  sessionExtraTtsRemaining: number | null;
  fallbackToBrowser: boolean;
  durationMs: number;
  recovered?: boolean;
  /** ISO 639-1 the turn intended, even if a 422 retry omitted language_code. */
  languageCode?: string;
}

export function createTtsRequestId(): string {
  return randomUUID();
}

export function resolveVoiceIdCategory(
  configuredVoiceId: string,
  attemptVoiceId: string,
): VoiceIdCategory {
  const premadeOverride = process.env.ELEVENLABS_PREMADE_VOICE_ID?.trim();
  const premadeIds = new Set([
    ELEVENLABS_DEFAULT_PREMADE_VOICE.id,
    ...(premadeOverride ? [premadeOverride] : []),
  ]);
  if (premadeIds.has(attemptVoiceId)) return "premade";
  if (attemptVoiceId === configuredVoiceId) return "library";
  return "premade";
}

/** Pull ElevenLabs `detail.status` (e.g. paid_plan_required) without secrets. */
export function parseElevenLabsErrorCode(detail?: string): string | undefined {
  if (!detail) return undefined;
  const safe = redactSecrets(detail);
  try {
    const parsed = JSON.parse(safe) as {
      detail?: { status?: string } | string;
      status?: string;
    };
    if (typeof parsed.detail === "object" && parsed.detail?.status) {
      return parsed.detail.status;
    }
    if (typeof parsed.detail === "string" && parsed.detail) {
      return parsed.detail;
    }
    if (parsed.status) return parsed.status;
  } catch {
    const match = safe.match(/"status"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function logTtsAttempt(payload: Omit<TtsAttemptLog, "event">): void {
  console.info(JSON.stringify({ event: "voice.tts.attempt", ...payload }));
}
