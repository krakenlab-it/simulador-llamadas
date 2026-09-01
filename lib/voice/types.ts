/** Speech-to-text provider tier (first match wins). */
export type SttTier =
  | "elevenlabs-scribe"
  | "google-chirp3"
  | "google-gemini-transcribe"
  | "browser";

/** Text-to-speech provider tier (first match wins). */
export type TtsTier =
  | "elevenlabs"
  | "google-chirp3"
  | "google-gemini-flash"
  | "browser";

export interface VoiceLadderConfig {
  sttTier: SttTier;
  ttsTier: TtsTier;
  /** ElevenLabs ConvAI available for patient persona (server-side key only). */
  convaiEnabled: boolean;
  /** Clinic pronunciation hints applied on server TTS. */
  pronunciationDictionary: boolean;
  /** Billed ElevenLabs path enabled (key + kill switch). */
  elevenlabsBilledAvailable: boolean;
}

export interface SttResult {
  transcript: string;
  tier: SttTier;
}

export interface TtsRequest {
  text: string;
}

export interface TtsResult {
  audio: Buffer;
  mimeType: string;
  tier: TtsTier;
}

export interface TtsAttemptFailure {
  tier: TtsTier;
  reason: string;
  status?: number;
  detail?: string;
}

export interface TtsSynthesisOutcome {
  result: TtsResult | null;
  failures: TtsAttemptFailure[];
}
