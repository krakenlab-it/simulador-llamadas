import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { synthesizeWithGoogleChirp3 } from "@/lib/voice/providers/google-chirp-tts";
import { synthesizeWithGeminiFlash } from "@/lib/voice/providers/google-gemini-tts";
import { resolveTtsTier } from "@/lib/voice/ladder";
import type { TtsTier } from "@/lib/voice/types";

export interface TtsResult {
  audio: Buffer;
  mimeType: string;
  tier: TtsTier;
}

/** Run TTS using the resolved tier, falling through on failure. */
export async function synthesizeSpeech(text: string): Promise<TtsResult | null> {
  const primary = resolveTtsTier();
  const chain = buildTtsChain(primary);

  for (const tier of chain) {
    const audio = await runTtsTier(tier, text);
    if (audio) {
      return { audio, mimeType: "audio/mpeg", tier };
    }
  }
  return null;
}

function buildTtsChain(primary: TtsTier): TtsTier[] {
  const all: TtsTier[] = ["elevenlabs", "google-chirp3", "google-gemini-flash"];
  return [primary, ...all.filter((t) => t !== primary && t !== "browser")];
}

async function runTtsTier(tier: TtsTier, text: string): Promise<Buffer | null> {
  switch (tier) {
    case "elevenlabs":
      return synthesizeWithElevenLabs(text);
    case "google-chirp3":
      return synthesizeWithGoogleChirp3(text);
    case "google-gemini-flash":
      return synthesizeWithGeminiFlash(text);
    case "browser":
      return null;
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
