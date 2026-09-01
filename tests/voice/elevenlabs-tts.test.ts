import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TTS_PROVIDER_TIMEOUT_MS } from "@/lib/voice/timeouts";

const API_KEY = "sk_super_secret_elevenlabs_key";

/** ElevenLabs MP3 payloads open with an ID3 tag. */
const MP3_BYTES = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x11, 0x22]);

function audioResponse(bytes: Uint8Array = MP3_BYTES): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "audio/mpeg" },
    arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  } as unknown as Response;
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    headers: { get: () => "application/json" },
    text: async () => body,
  } as unknown as Response;
}

/** A 200 whose body is actually a JSON error — silence if shipped as audio. */
function jsonBodyResponse(body: string): Response {
  const bytes = new TextEncoder().encode(body);
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  } as unknown as Response;
}

async function loadProvider() {
  return import("@/lib/voice/providers/elevenlabs");
}

function calledUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([url]) => String(url));
}

function calledBody(index: number): Record<string, unknown> {
  const init = vi.mocked(fetch).mock.calls[index]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe("synthesizeWithElevenLabs", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", API_KEY);
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-123");
    vi.stubEnv("ELEVENLABS_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(audioResponse()));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("buffers a complete MP3 from the convert endpoint with Spanish flash v2.5", async () => {
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Eso no mueve venta por m².");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(calledUrls()[0]).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-123?output_format=mp3_44100_128",
    );
    expect(calledBody(0)).toEqual({
      text: "Eso no mueve venta por m².",
      model_id: "eleven_flash_v2_5",
      language_code: "es",
    });
    if (result.ok) {
      expect(result.endpoint).toBe("convert");
      expect(result.value.equals(Buffer.from(MP3_BYTES))).toBe(true);
    }
  });

  it("sends an abort signal so a hung ElevenLabs call cannot outlive the request", async () => {
    const { synthesizeWithElevenLabs } = await loadProvider();
    await synthesizeWithElevenLabs("Hola");

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, "authentication_error"],
    [403, "authorization_error"],
    [404, "voice_not_found"],
    [429, "rate_limit_error"],
  ])(
    "reports HTTP %i as terminal without a second billed attempt",
    async (status, detail) => {
      vi.mocked(fetch).mockResolvedValue(
        errorResponse(status, `{"detail":{"status":"${detail}"}}`),
      );
      const { synthesizeWithElevenLabs } = await loadProvider();

      const result = await synthesizeWithElevenLabs("Hola");

      expect(result.ok).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.failures).toEqual([
        {
          reason: "elevenlabs_http_error",
          status,
          detail: `{"detail":{"status":"${detail}"}}`,
          endpoint: "convert",
        },
      ]);
    },
  );

  it("retries on a documented premade voice after a library-voice 402", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const library402 =
      '{"detail":{"status":"paid_plan_required","message":"Free users cannot use library voices via the API."}}';
    vi.mocked(fetch)
      .mockResolvedValueOnce(errorResponse(402, library402))
      .mockResolvedValueOnce(audioResponse());

    const { synthesizeWithElevenLabs, ELEVENLABS_DEFAULT_PREMADE_VOICE } =
      await loadProvider();
    const result = await synthesizeWithElevenLabs("Hola, soy Mariana.");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(calledUrls()[1]).toContain(ELEVENLABS_DEFAULT_PREMADE_VOICE.id);
    expect(calledBody(1)).toEqual({
      text: "Hola, soy Mariana.",
      model_id: "eleven_flash_v2_5",
      language_code: "es",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "voice.tts.elevenlabs_premade_fallback",
      expect.objectContaining({
        status: 402,
        configuredVoiceId: "voice-123",
        premadeVoiceId: ELEVENLABS_DEFAULT_PREMADE_VOICE.id,
        premadeVoiceName: ELEVENLABS_DEFAULT_PREMADE_VOICE.name,
      }),
    );
    if (result.ok) {
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].status).toBe(402);
    }
    warnSpy.mockRestore();
  });

  it("uses ELEVENLABS_PREMADE_VOICE_ID when the library voice is blocked", async () => {
    vi.stubEnv("ELEVENLABS_PREMADE_VOICE_ID", "premade-override");
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        errorResponse(
          402,
          '{"detail":{"status":"paid_plan_required","message":"library voice"}}',
        ),
      )
      .mockResolvedValueOnce(audioResponse());

    const { synthesizeWithElevenLabs } = await loadProvider();
    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(true);
    expect(calledUrls()[1]).toContain("premade-override");
  });

  it("does not retry a different voice after a non-library 402", async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(402, '{"detail":{"status":"quota_exceeded"}}'),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry premade when the configured voice is already premade", async () => {
    vi.stubEnv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL");
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(
        402,
        '{"detail":{"status":"paid_plan_required","message":"library voice"}}',
      ),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on the stream endpoint without language_code after a 422", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        errorResponse(422, '{"detail":[{"loc":["body","language_code"]}]}'),
      )
      .mockResolvedValueOnce(audioResponse());
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola Rodrigo.");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(calledUrls()[1]).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-123/stream?output_format=mp3_44100_128",
    );
    expect(calledBody(1)).toEqual({
      text: "Hola Rodrigo.",
      model_id: "eleven_flash_v2_5",
    });
    if (result.ok) {
      expect(result.endpoint).toBe("stream");
      // The recovered turn still reports the broken endpoint for the logs.
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].status).toBe(422);
    }
  });

  it("reports empty audio from both endpoints", async () => {
    vi.mocked(fetch).mockResolvedValue(audioResponse(new Uint8Array()));
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.failures.map((f) => f.reason)).toEqual([
      "elevenlabs_empty_audio",
      "elevenlabs_empty_audio",
    ]);
    expect(result.failures.map((f) => f.endpoint)).toEqual(["convert", "stream"]);
  });

  it("rejects a 200 that carries a JSON error body instead of audio", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonBodyResponse('{"detail":{"status":"quota_exceeded"}}'),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(result.failures[0].reason).toBe("elevenlabs_non_audio_response");
    expect(result.failures[0].detail).toContain("quota_exceeded");
    expect(result.failures[0].detail).toContain("content-type=application/json");
  });

  it("accepts audio bytes whenever the response is typed as audio", async () => {
    const opaque = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    vi.mocked(fetch).mockResolvedValue(audioResponse(opaque));
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a timeout instead of hanging past the request budget", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("This operation was aborted", "AbortError"));
          });
        }),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const pending = synthesizeWithElevenLabs("Hola");
    await vi.advanceTimersByTimeAsync(TTS_PROVIDER_TIMEOUT_MS + 50);
    const result = await pending;

    expect(result.ok).toBe(false);
    // A timed-out budget must not be spent again on a second attempt.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.failures[0].reason).toBe("elevenlabs_timeout");
    vi.useRealTimers();
  });

  it("reports a network exception with a redacted message", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new Error(`socket hang up while sending xi-api-key ${API_KEY}`),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(result.failures[0].reason).toBe("elevenlabs_exception");
    expect(result.failures[0].detail).not.toContain(API_KEY);
    expect(result.failures[0].detail).toContain("[redacted:ELEVENLABS_API_KEY]");
  });

  it("never echoes the API key back from an ElevenLabs error body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(401, `{"detail":"invalid key ${API_KEY}"}`),
    );
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.failures[0].detail).not.toContain(API_KEY);
  });

  it.each([
    ["ELEVENLABS_ENABLED", "false", "elevenlabs_disabled"],
    // No key means the kill switch reads as off, so that reason wins here.
    ["ELEVENLABS_API_KEY", "", "elevenlabs_disabled"],
    ["ELEVENLABS_VOICE_ID", "", "missing_ELEVENLABS_VOICE_ID"],
  ])("skips the billed call when %s is %s", async (key, value, reason) => {
    vi.stubEnv(key, value);
    const { synthesizeWithElevenLabs } = await loadProvider();

    const result = await synthesizeWithElevenLabs("Hola");

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([{ reason }]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
