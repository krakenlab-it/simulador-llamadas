import type { SttTier, TtsTier, VoiceLadderConfig } from "@/lib/voice/types";
import { isElevenLabsEnabled } from "@/lib/voice/brakes";

function hasElevenLabsKey(): boolean {
  return isElevenLabsEnabled();
}

function hasElevenLabsVoice(): boolean {
  return Boolean(process.env.ELEVENLABS_VOICE_ID?.trim());
}

/**
 * ConvAI stays out of the call loop unless it is switched on explicitly. The
 * working voice path is browser mic in, HTTP turn, TTS out; ConvAI agent
 * creation is opt-in so a missing or rejected agent can never break a call.
 */
function isConvaiOptedIn(): boolean {
  return process.env.ELEVENLABS_CONVAI_ENABLED?.trim().toLowerCase() === "true";
}

function hasGoogleApplicationCredentials(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}

function hasGoogleApiKey(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY?.trim());
}

function hasGcpProjectId(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID?.trim());
}

/**
 * Resolve STT tier — first match wins.
 * ElevenLabs Scribe only when billed path is enabled (key + ELEVENLABS_ENABLED).
 */
export function resolveSttTier(): SttTier {
  if (hasElevenLabsKey()) {
    return "elevenlabs-scribe";
  }
  if (hasGoogleApplicationCredentials() && hasGcpProjectId()) {
    return "google-chirp3";
  }
  if (hasGoogleApiKey()) {
    return "google-gemini-transcribe";
  }
  return "browser";
}

/**
 * Resolve TTS tier — ElevenLabs when key + voice id are set, otherwise browser.
 * No Google Chirp/Gemini TTS; billed failure → 502 → client speechSynthesis.
 */
export function resolveTtsTier(): TtsTier {
  if (hasElevenLabsKey() && hasElevenLabsVoice()) {
    return "elevenlabs";
  }
  return "browser";
}

/** Full voice ladder snapshot for server routes and client config. */
export function resolveVoiceLadder(): VoiceLadderConfig {
  const sttTier = resolveSttTier();
  const ttsTier = resolveTtsTier();

  return {
    sttTier,
    ttsTier,
    convaiEnabled: isConvaiOptedIn() && hasElevenLabsKey() && hasElevenLabsVoice(),
    pronunciationDictionary: ttsTier === "elevenlabs",
    elevenlabsBilledAvailable: hasElevenLabsKey(),
  };
}

export function isServerSttTier(tier: SttTier): boolean {
  return tier !== "browser";
}

export function isServerTtsTier(tier: TtsTier): boolean {
  return tier !== "browser";
}

/** True when the resolved tier uses billed ElevenLabs APIs. */
export function isElevenLabsTier(tier: SttTier | TtsTier): boolean {
  return tier === "elevenlabs-scribe" || tier === "elevenlabs";
}
