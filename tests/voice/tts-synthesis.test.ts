import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/voice/providers/elevenlabs", () => ({
  synthesizeWithElevenLabs: vi.fn(),
}));

vi.mock("@/lib/voice/providers/google-chirp-tts", () => ({
  synthesizeWithGoogleChirp3: vi.fn(),
}));

vi.mock("@/lib/voice/providers/google-gemini-tts", () => ({
  synthesizeWithGeminiFlash: vi.fn(),
}));

vi.mock("@/lib/voice/ladder", () => ({
  resolveTtsTier: vi.fn(() => "elevenlabs"),
}));

import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { synthesizeWithGoogleChirp3 } from "@/lib/voice/providers/google-chirp-tts";
import { synthesizeWithGeminiFlash } from "@/lib/voice/providers/google-gemini-tts";
import { synthesizeSpeech } from "@/lib/voice/tts";

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: false,
      reason: "elevenlabs_http_error",
      status: 401,
      detail: '{"detail":"invalid_api_key"}',
    });
    vi.mocked(synthesizeWithGoogleChirp3).mockResolvedValue({
      ok: false,
      reason: "missing_GOOGLE_APPLICATION_CREDENTIALS",
    });
    vi.mocked(synthesizeWithGeminiFlash).mockResolvedValue({
      ok: false,
      reason: "missing_GOOGLE_API_KEY",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns attempt diagnostics when every provider fails", async () => {
    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result).toBeNull();
    expect(outcome.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tier: "elevenlabs",
          status: 401,
          reason: "elevenlabs_http_error",
        }),
        expect.objectContaining({
          tier: "google-chirp3",
          reason: "missing_GOOGLE_APPLICATION_CREDENTIALS",
        }),
        expect.objectContaining({
          tier: "google-gemini-flash",
          reason: "missing_GOOGLE_API_KEY",
        }),
      ]),
    );
  });

  it("returns audio from the first successful tier", async () => {
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: true,
      value: Buffer.from([1, 2, 3]),
    });

    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result).toEqual(
      expect.objectContaining({
        tier: "elevenlabs",
        mimeType: "audio/mpeg",
      }),
    );
    expect(outcome.failures).toEqual([]);
    expect(synthesizeWithGoogleChirp3).not.toHaveBeenCalled();
  });
});
