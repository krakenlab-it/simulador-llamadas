import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { resolveTtsTier } from "@/lib/voice/ladder";
import type { TtsAttemptFailure, TtsSynthesisOutcome } from "@/lib/voice/types";

export type { TtsResult } from "@/lib/voice/types";

/** Billed TTS: ElevenLabs only. On failure the route returns 502 → browser speechSynthesis. */
export async function synthesizeSpeech(text: string): Promise<TtsSynthesisOutcome> {
  const tier = resolveTtsTier();
  if (tier !== "elevenlabs") {
    return {
      result: null,
      failures: [{ tier: "browser", reason: "server_tts_not_configured" }],
    };
  }

  const outcome = await synthesizeWithElevenLabs(text);
  if (!outcome.ok) {
    const failure: TtsAttemptFailure = {
      tier: "elevenlabs",
      reason: outcome.reason,
      status: outcome.status,
      detail: outcome.detail,
    };
    return { result: null, failures: [failure] };
  }

  return {
    result: { audio: outcome.value, mimeType: "audio/mpeg", tier: "elevenlabs" },
    failures: [],
  };
}
