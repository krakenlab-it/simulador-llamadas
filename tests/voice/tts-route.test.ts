import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_KEY = "sk_super_secret_elevenlabs_key";

vi.mock("@/lib/session", () => ({
  withPgClient: vi.fn(async (fn: (client: unknown) => unknown) => fn({})),
}));

vi.mock("@/lib/voice/ladder", () => ({
  resolveTtsTier: vi.fn(() => "elevenlabs"),
  isServerTtsTier: (tier: string) => tier !== "browser",
  isElevenLabsTier: (tier: string) =>
    tier === "elevenlabs" || tier === "elevenlabs-scribe",
}));

vi.mock("@/lib/voice/tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/voice/tts")>();
  return { ...actual, synthesizeSpeech: vi.fn() };
});

vi.mock("@/lib/voice/gates", () => ({
  gateElevenLabsCall: vi.fn(async () => ({ allowed: true, fallbackToBrowser: false })),
}));

vi.mock("@/lib/voice/usage", () => ({
  recordExtraTtsChars: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/require-voice-session", () => ({
  resolveVoiceAuth: vi.fn(async () => ({
    supabaseUserId: "sb-1",
    email: "trainee@example.com",
    accessToken: "token",
    verifiedUserId: "verified-1",
  })),
  isVoiceAuthContext: () => true,
  assertSessionOwnership: vi.fn(async () => true),
}));

import { POST } from "@/app/api/voice/tts/route";
import { synthesizeSpeech } from "@/lib/voice/tts";

function ttsRequest(text = "¿Quién habla?"): Request {
  return new Request("https://example.com/api/voice/tts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-voice-session-id": "usage-1",
    },
    body: JSON.stringify({ text, sessionUsageId: "usage-1" }),
  });
}

describe("POST /api/voice/tts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", API_KEY);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("logs the ElevenLabs reason server-side when synthesis fails", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: null,
      failures: [
        {
          tier: "elevenlabs",
          reason: "elevenlabs_http_error",
          status: 402,
          detail: '{"detail":{"status":"quota_exceeded"}}',
          endpoint: "convert",
        },
      ],
    });

    const response = await POST(ttsRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ fallbackToBrowser: true }),
    );

    expect(errorSpy).toHaveBeenCalledWith("voice.tts.elevenlabs_failed", {
      recovered: false,
      textLength: "¿Quién habla?".length,
      attempts:
        'convert:elevenlabs_http_error status=402 detail={"detail":{"status":"quota_exceeded"}}',
    });
  });

  it("logs a recovered turn so a degraded endpoint is visible before it dies", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: {
        audio: Buffer.from([0x49, 0x44, 0x33, 0x04]),
        mimeType: "audio/mpeg",
        tier: "elevenlabs",
        endpoint: "stream",
      },
      failures: [
        { tier: "elevenlabs", reason: "elevenlabs_empty_audio", endpoint: "convert" },
      ],
    });

    const response = await POST(ttsRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("x-voice-endpoint")).toBe("stream");
    expect(errorSpy).toHaveBeenCalledWith(
      "voice.tts.elevenlabs_failed",
      expect.objectContaining({ recovered: true }),
    );
  });

  it("stays quiet when the billed call succeeds outright", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: {
        audio: Buffer.from([0x49, 0x44, 0x33, 0x04]),
        mimeType: "audio/mpeg",
        tier: "elevenlabs",
        endpoint: "convert",
      },
      failures: [],
    });

    const response = await POST(ttsRequest());

    expect(response.status).toBe(200);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("never writes the ElevenLabs API key into the log line", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: null,
      failures: [
        {
          tier: "elevenlabs",
          reason: "elevenlabs_exception",
          detail: "socket hang up [redacted:ELEVENLABS_API_KEY]",
          endpoint: "convert",
        },
      ],
    });

    await POST(ttsRequest());

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(API_KEY);
  });
});
