/** A single failed provider attempt, safe to log (no secrets). */
export interface ProviderFailure {
  reason: string;
  status?: number;
  detail?: string;
  /** Which provider endpoint produced the failure. Never contains credentials. */
  endpoint?: string;
}

/** Outcome from a single voice provider call (TTS/STT). */
export type ProviderOutcome<T> =
  | { ok: true; value: T }
  | ({ ok: false } & ProviderFailure);

export function providerSkipped<T>(reason: string): ProviderOutcome<T> {
  return { ok: false, reason };
}

/**
 * Env vars whose values must never reach a log line or an HTTP response body.
 * Provider error payloads are echoed back to us verbatim, so scrub them.
 */
const SECRET_ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "DATABASE_URL",
] as const;

/** Replace any configured secret value found in free text with a marker. */
export function redactSecrets(text: string): string {
  let redacted = text;
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value && value.length >= 8) {
      redacted = redacted.replaceAll(value, `[redacted:${key}]`);
    }
  }
  return redacted;
}

export async function readResponseDetail(
  response: Response,
  maxChars = 500,
): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    const safe = redactSecrets(text);
    return safe.length > maxChars ? `${safe.slice(0, maxChars)}…` : safe;
  } catch {
    return undefined;
  }
}
