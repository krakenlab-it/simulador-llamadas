import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/voice/providers/elevenlabs", () => ({
  synthesizeWithElevenLabs: vi.fn(),
}));

vi.mock("@/lib/voice/ladder", () => ({
  resolveTtsTier: vi.fn(() => "elevenlabs"),
}));

import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { synthesizeSpeech } from "@/lib/voice/tts";
import { resolveTtsTier } from "@/lib/voice/ladder";

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.mocked(resolveTtsTier).mockReturnValue("elevenlabs");
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: false,
      reason: "elevenlabs_http_error",
      status: 401,
      detail: '{"detail":"invalid_api_key"}',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns ElevenLabs attempt diagnostics when synthesis fails", async () => {
    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result).toBeNull();
    expect(outcome.failures).toEqual([
      expect.objectContaining({
        tier: "elevenlabs",
        status: 401,
        reason: "elevenlabs_http_error",
      }),
    ]);
    expect(synthesizeWithElevenLabs).toHaveBeenCalledTimes(1);
  });

  it("returns audio from ElevenLabs without calling other providers", async () => {
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
    expect(synthesizeWithElevenLabs).toHaveBeenCalledTimes(1);
  });

  it("skips ElevenLabs when server TTS is not configured", async () => {
    vi.mocked(resolveTtsTier).mockReturnValue("browser");

    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result).toBeNull();
    expect(outcome.failures).toEqual([
      expect.objectContaining({ reason: "server_tts_not_configured" }),
    ]);
    expect(synthesizeWithElevenLabs).not.toHaveBeenCalled();
  });
});
