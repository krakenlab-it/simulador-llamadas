import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { synthesizeWithGoogleChirp3 } from "@/lib/voice/providers/google-chirp-tts";
import { synthesizeWithGeminiFlash } from "@/lib/voice/providers/google-gemini-tts";
import { resolveTtsTier } from "@/lib/voice/ladder";
import type {
  TtsAttemptFailure,
  TtsSynthesisOutcome,
  TtsTier,
} from "@/lib/voice/types";
import type { ProviderOutcome } from "@/lib/voice/provider-result";

export type { TtsResult } from "@/lib/voice/types";

/** Run TTS using the resolved tier, falling through on failure. */
export async function synthesizeSpeech(text: string): Promise<TtsSynthesisOutcome> {
  const primary = resolveTtsTier();
  const chain = buildTtsChain(primary);
  const failures: TtsAttemptFailure[] = [];

  for (const tier of chain) {
    const outcome = await runTtsTier(tier, text);
    if (!outcome.ok) {
      failures.push({
        tier,
        reason: outcome.reason,
        status: outcome.status,
        detail: outcome.detail,
      });
      continue;
    }
    return {
      result: { audio: outcome.value, mimeType: "audio/mpeg", tier },
      failures,
    };
  }

  return { result: null, failures };
}

function buildTtsChain(primary: TtsTier): TtsTier[] {
  const all: TtsTier[] = ["elevenlabs", "google-chirp3", "google-gemini-flash"];
  return [primary, ...all.filter((t) => t !== primary && t !== "browser")];
}

async function runTtsTier(
  tier: TtsTier,
  text: string,
): Promise<ProviderOutcome<Buffer>> {
  switch (tier) {
    case "elevenlabs":
      return synthesizeWithElevenLabs(text);
    case "google-chirp3":
      return synthesizeWithGoogleChirp3(text);
    case "google-gemini-flash":
      return synthesizeWithGeminiFlash(text);
    case "browser":
      return { ok: false, reason: "browser_not_server_tier" };
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
