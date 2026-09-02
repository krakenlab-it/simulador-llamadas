import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { resolveTtsTier } from "@/lib/voice/ladder";
import type { TtsTraceContext } from "@/lib/voice/tts-trace";
import type { TtsAttemptFailure, TtsSynthesisOutcome } from "@/lib/voice/types";

export type { TtsResult } from "@/lib/voice/types";

/**
 * One-line, secret-free summary of the billed TTS attempts. Without this the
 * only copy of the ElevenLabs reason lives in the 502 body the browser throws
 * away, which is why production 502s were undiagnosable.
 */
export function describeTtsFailures(failures: TtsAttemptFailure[]): string {
  return failures
    .map((failure) => {
      const label = failure.endpoint
        ? `${failure.endpoint}:${failure.reason}`
        : failure.reason;
      const parts = [label];
      if (failure.status !== undefined) parts.push(`status=${failure.status}`);
      if (failure.detail) parts.push(`detail=${failure.detail}`);
      return parts.join(" ");
    })
    .join(" | ");
}

/** Billed TTS: ElevenLabs only. On failure the route returns 502 → browser speechSynthesis. */
export async function synthesizeSpeech(
  text: string,
  trace?: TtsTraceContext,
): Promise<TtsSynthesisOutcome> {
  const tier = resolveTtsTier();
  if (tier !== "elevenlabs") {
    return {
      result: null,
      failures: [{ tier: "browser", reason: "server_tts_not_configured" }],
    };
  }

  const outcome = await synthesizeWithElevenLabs(text, trace);
  const failures: TtsAttemptFailure[] = outcome.failures.map((failure) => ({
    tier: "elevenlabs",
    ...failure,
  }));

  if (!outcome.ok) {
    return { result: null, failures };
  }

  return {
    result: {
      audio: outcome.value,
      mimeType: "audio/mpeg",
      tier: "elevenlabs",
      endpoint: outcome.endpoint,
    },
    // A recovered turn still carries the first attempt's failure so the log
    // shows which endpoint is degraded before it fails outright.
    failures,
  };
}
