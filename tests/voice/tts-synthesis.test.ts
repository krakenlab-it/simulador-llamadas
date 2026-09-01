import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/voice/providers/elevenlabs", () => ({
  synthesizeWithElevenLabs: vi.fn(),
}));

vi.mock("@/lib/voice/ladder", () => ({
  resolveTtsTier: vi.fn(() => "elevenlabs"),
}));

import { synthesizeWithElevenLabs } from "@/lib/voice/providers/elevenlabs";
import { describeTtsFailures, synthesizeSpeech } from "@/lib/voice/tts";
import { resolveTtsTier } from "@/lib/voice/ladder";

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.mocked(resolveTtsTier).mockReturnValue("elevenlabs");
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: false,
      failures: [
        {
          reason: "elevenlabs_http_error",
          status: 401,
          detail: '{"detail":"invalid_api_key"}',
          endpoint: "convert",
        },
      ],
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
        endpoint: "convert",
      }),
    ]);
    expect(synthesizeWithElevenLabs).toHaveBeenCalledTimes(1);
  });

  it("carries every failed attempt so the route can log the whole ladder", async () => {
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: false,
      failures: [
        { reason: "elevenlabs_http_error", status: 422, endpoint: "convert" },
        { reason: "elevenlabs_empty_audio", endpoint: "stream" },
      ],
    });

    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.failures).toHaveLength(2);
    expect(outcome.failures.every((f) => f.tier === "elevenlabs")).toBe(true);
  });

  it("returns audio from ElevenLabs without calling other providers", async () => {
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: true,
      value: Buffer.from([1, 2, 3]),
      endpoint: "convert",
      failures: [],
    });

    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result).toEqual(
      expect.objectContaining({
        tier: "elevenlabs",
        mimeType: "audio/mpeg",
        endpoint: "convert",
      }),
    );
    expect(outcome.failures).toEqual([]);
    expect(synthesizeWithElevenLabs).toHaveBeenCalledTimes(1);
  });

  it("still reports the degraded endpoint when a retry recovered the audio", async () => {
    vi.mocked(synthesizeWithElevenLabs).mockResolvedValue({
      ok: true,
      value: Buffer.from([1, 2, 3]),
      endpoint: "stream",
      failures: [
        { reason: "elevenlabs_http_error", status: 422, endpoint: "convert" },
      ],
    });

    const outcome = await synthesizeSpeech("Hola");

    expect(outcome.result?.endpoint).toBe("stream");
    expect(outcome.failures).toHaveLength(1);
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

describe("describeTtsFailures", () => {
  it("renders endpoint, reason, status and detail on one line", () => {
    const line = describeTtsFailures([
      {
        tier: "elevenlabs",
        reason: "elevenlabs_http_error",
        status: 402,
        detail: '{"detail":{"status":"quota_exceeded"}}',
        endpoint: "convert",
      },
      { tier: "elevenlabs", reason: "elevenlabs_empty_audio", endpoint: "stream" },
    ]);

    expect(line).toBe(
      'convert:elevenlabs_http_error status=402 detail={"detail":{"status":"quota_exceeded"}}' +
        " | stream:elevenlabs_empty_audio",
    );
  });

  it("renders skip reasons that never reached an endpoint", () => {
    expect(
      describeTtsFailures([{ tier: "browser", reason: "server_tts_not_configured" }]),
    ).toBe("server_tts_not_configured");
  });
});
