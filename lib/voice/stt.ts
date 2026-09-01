import {
  transcribeWithElevenLabsScribe,
} from "@/lib/voice/providers/elevenlabs";
import { transcribeWithGoogleChirp3 } from "@/lib/voice/providers/google-chirp-stt";
import { transcribeWithGemini } from "@/lib/voice/providers/google-gemini-stt";
import { resolveSttTier } from "@/lib/voice/ladder";
import type { SttResult } from "@/lib/voice/types";

/** Run STT using the resolved tier, falling through on failure. */
export async function transcribeAudio(
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  const primary = resolveSttTier();
  const chain = buildSttChain(primary);

  for (const tier of chain) {
    const result = await runSttTier(tier, audioBytes, mimeType);
    if (result) return result;
  }
  return null;
}

function buildSttChain(primary: ReturnType<typeof resolveSttTier>): Array<
  Exclude<ReturnType<typeof resolveSttTier>, "browser">
> {
  const all: Array<Exclude<ReturnType<typeof resolveSttTier>, "browser">> = [
    "elevenlabs-scribe",
    "google-chirp3",
    "google-gemini-transcribe",
  ];
  if (primary === "browser") return all;
  return [primary, ...all.filter((t) => t !== primary)];
}

async function runSttTier(
  tier: ReturnType<typeof resolveSttTier>,
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  switch (tier) {
    case "elevenlabs-scribe":
      return transcribeWithElevenLabsScribe(audioBytes, mimeType);
    case "google-chirp3":
      return transcribeWithGoogleChirp3(audioBytes, mimeType);
    case "google-gemini-transcribe":
      return transcribeWithGemini(audioBytes, mimeType);
    case "browser":
      return null;
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
