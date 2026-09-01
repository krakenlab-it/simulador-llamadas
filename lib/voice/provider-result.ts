/** Outcome from a single voice provider call (TTS/STT). */
export type ProviderOutcome<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: string;
      status?: number;
      detail?: string;
    };

export function providerSkipped<T>(reason: string): ProviderOutcome<T> {
  return { ok: false, reason };
}

export async function readResponseDetail(
  response: Response,
  maxChars = 500,
): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
  } catch {
    return undefined;
  }
}
