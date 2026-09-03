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
  getSessionUsage: vi.fn(async () => ({
    id: "usage-1",
    verifiedUserId: "verified-1",
    convaiSecondsUsed: 0,
    traineeAudioSecondsUsed: 0,
    extraTtsCharsUsed: 0,
    convaiSlotHeld: false,
  })),
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
import {
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_TTS_MAX_CHARS_PER_TURN,
} from "@/lib/voice/brakes";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { getSessionUsage, recordExtraTtsChars } from "@/lib/voice/usage";
import { synthesizeSpeech } from "@/lib/voice/tts";
import type { TtsAttemptLog } from "@/lib/voice/tts-trace";

function ramblingPatientLine(minChars: number): string {
  const chunk =
    "Mire, yo entiendo lo que dice, pero en la clínica ya tenemos muchos proveedores " +
    "y la verdad es que no veo cómo esto me ayuda con las citas de la tarde ni con el personal " +
    "que ya está saturado atendiendo pacientes en recepción y en consultorio todos los días. ";
  let text = "";
  while (text.length < minChars) text += chunk;
  return text.trim();
}

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

function attemptLogs(spy: ReturnType<typeof vi.spyOn>): TtsAttemptLog[] {
  return spy.mock.calls
    .map((call) => {
      const raw = call[0];
      if (typeof raw !== "string" || !raw.startsWith("{")) return null;
      try {
        return JSON.parse(raw) as TtsAttemptLog;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is TtsAttemptLog => entry?.event === "voice.tts.attempt");
}

describe("POST /api/voice/tts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", API_KEY);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
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

    expect(errorSpy).toHaveBeenCalledWith(
      "voice.tts.elevenlabs_failed",
      expect.objectContaining({
        recovered: false,
        textLength: "¿Quién habla?".length,
        attempts:
          'convert:elevenlabs_http_error status=402 detail={"detail":{"status":"quota_exceeded"}}',
      }),
    );
    const logs = attemptLogs(infoSpy);
    expect(logs.at(-1)).toEqual(
      expect.objectContaining({
        event: "voice.tts.attempt",
        httpStatus: 502,
        fallbackToBrowser: true,
        failureReason: "elevenlabs_http_error",
        charsRequested: "¿Quién habla?".length,
        charsSent: 0,
      }),
    );
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
    expect(attemptLogs(infoSpy).at(-1)).toEqual(
      expect.objectContaining({ fallbackToBrowser: false, recovered: true }),
    );
  });

  it("stays quiet on elevenlabs_failed when the billed call succeeds outright", async () => {
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
    expect(attemptLogs(infoSpy).at(-1)).toEqual(
      expect.objectContaining({
        charsRequested: "¿Quién habla?".length,
        charsSent: "¿Quién habla?".length,
        fallbackToBrowser: false,
        sessionExtraTtsRemaining: SESSION_EXTRA_TTS_MAX_CHARS,
      }),
    );
  });

  it("refuses punctuation-only lines without billing ElevenLabs", async () => {
    const response = await POST(ttsRequest("..."));

    expect(response.status).toBe(400);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(attemptLogs(infoSpy).at(-1)).toEqual(
      expect.objectContaining({
        charsRequested: 3,
        charsSent: 0,
        fallbackToBrowser: true,
        failureReason: "not_speakable",
      }),
    );
  });

  it("truncates long patient lines before synthesis and meters sent chars", async () => {
    const long = ramblingPatientLine(SESSION_TTS_MAX_CHARS_PER_TURN + 80);
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: {
        audio: Buffer.from([0x49, 0x44, 0x33, 0x04]),
        mimeType: "audio/mpeg",
        tier: "elevenlabs",
        endpoint: "convert",
      },
      failures: [],
    });

    const response = await POST(ttsRequest(long));

    expect(response.status).toBe(200);
    const spoken = vi.mocked(synthesizeSpeech).mock.calls[0]?.[0] as string;
    expect(spoken.length).toBeLessThan(long.length);
    expect(spoken.length).toBeLessThanOrEqual(SESSION_TTS_MAX_CHARS_PER_TURN);
    expect(attemptLogs(infoSpy).at(-1)).toEqual(
      expect.objectContaining({
        charsRequested: long.length,
        charsSent: spoken.length,
        fallbackToBrowser: false,
      }),
    );
  });

  it("still caps billed TTS when the trainer sends voice knobs", async () => {
    const long = ramblingPatientLine(SESSION_TTS_MAX_CHARS_PER_TURN + 80);
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: {
        audio: Buffer.from([0x49, 0x44, 0x33, 0x04]),
        mimeType: "audio/mpeg",
        tier: "elevenlabs",
        endpoint: "convert",
      },
      failures: [],
    });

    const response = await POST(
      new Request("https://example.com/api/voice/tts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-voice-session-id": "usage-1",
        },
        body: JSON.stringify({
          text: long,
          sessionUsageId: "usage-1",
          voiceId: "EXAVITQu4vr4xnSDxMaL",
          language: "en",
          speakingRate: 1.15,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const spoken = vi.mocked(synthesizeSpeech).mock.calls[0]?.[0] as string;
    expect(spoken.length).toBeLessThanOrEqual(SESSION_TTS_MAX_CHARS_PER_TURN);
    const options = vi.mocked(synthesizeSpeech).mock.calls[0]?.[2];
    expect(options).toEqual(
      expect.objectContaining({
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        language: "en",
        speakingRate: 1.15,
      }),
    );
  });

  it("returns browser fallback when the session extra TTS cap is exceeded", async () => {
    vi.mocked(getSessionUsage).mockResolvedValueOnce({
      id: "usage-1",
      verifiedUserId: "verified-1",
      convaiSecondsUsed: 0,
      traineeAudioSecondsUsed: 0,
      extraTtsCharsUsed: SESSION_EXTRA_TTS_MAX_CHARS - 12,
      convaiSlotHeld: false,
    });
    vi.mocked(gateElevenLabsCall).mockResolvedValueOnce({
      allowed: false,
      reason: "session_extra_tts_limit",
      fallbackToBrowser: true,
    });

    const response = await POST(ttsRequest("Hola Mariana."));

    expect(response.status).toBe(429);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(attemptLogs(infoSpy).at(-1)).toEqual(
      expect.objectContaining({
        charsRequested: "Hola Mariana.".length,
        charsSent: 0,
        sessionExtraTtsRemaining: 12,
        fallbackToBrowser: true,
        failureReason: "session_extra_tts_limit",
      }),
    );
  });

  it("still returns billed audio when metering fails after ElevenLabs succeeds", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      result: {
        audio: Buffer.from([0x49, 0x44, 0x33, 0x04]),
        mimeType: "audio/mpeg",
        tier: "elevenlabs",
        endpoint: "convert",
      },
      failures: [],
    });
    vi.mocked(recordExtraTtsChars).mockRejectedValueOnce(
      new Error("voice_session_usage write failed"),
    );

    const response = await POST(ttsRequest("Buenas tardes, ¿quién habla?"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
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

    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(API_KEY);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(API_KEY);
  });
});
