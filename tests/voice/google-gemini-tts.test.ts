import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GEMINI_TTS_PCM_SAMPLE_RATE,
  normalizeGeminiTtsAudioBytes,
  wrapLinearPcmAsWav,
} from "@/lib/voice/providers/google-gemini-tts-audio";

const API_KEY = "test-google-api-key-not-real";

function geminiAudioResponse(
  audioBytes: Buffer,
  mimeType = "audio/wav",
): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBytes.toString("base64"),
                },
              },
            ],
          },
        },
      ],
    }),
  } as unknown as Response;
}

async function loadProvider() {
  return import("@/lib/voice/providers/google-gemini-tts");
}

function modelFromFetchCall(): string {
  const url = String(vi.mocked(fetch).mock.calls[0]?.[0] ?? "");
  const match = url.match(/\/models\/([^:]+):generateContent/);
  return match?.[1] ?? "";
}

describe("resolveGeminiTtsModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to gemini-3.8-flash-tts", async () => {
    vi.stubEnv("GEMINI_TTS_MODEL", "");
    const { resolveGeminiTtsModel, DEFAULT_GEMINI_TTS_MODEL } =
      await loadProvider();
    expect(DEFAULT_GEMINI_TTS_MODEL).toBe("gemini-3.8-flash-tts");
    expect(resolveGeminiTtsModel()).toBe("gemini-3.8-flash-tts");
  });

  it("honors GEMINI_TTS_MODEL override (model name only)", async () => {
    vi.stubEnv("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts");
    const { resolveGeminiTtsModel } = await loadProvider();
    expect(resolveGeminiTtsModel()).toBe("gemini-3.8-flash-lite-tts");
  });
});

describe("normalizeGeminiTtsAudioBytes", () => {
  it("wraps audio/l16 PCM in a RIFF WAV header", () => {
    const pcm = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const wav = normalizeGeminiTtsAudioBytes(pcm, "audio/l16;codec=pcm;rate=24000");
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it("passes through existing WAV bytes", () => {
    const wav = wrapLinearPcmAsWav(Buffer.from([0x7f, 0x00]));
    const out = normalizeGeminiTtsAudioBytes(wav, "audio/wav");
    expect(out).toEqual(wav);
  });

  it("uses 24 kHz in the WAV fmt chunk", () => {
    const wav = wrapLinearPcmAsWav(Buffer.alloc(4));
    expect(wav.readUInt32LE(24)).toBe(GEMINI_TTS_PCM_SAMPLE_RATE);
  });
});

describe("synthesizeWithGeminiFlash", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", API_KEY);
    vi.stubEnv("GEMINI_TTS_MODEL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(geminiAudioResponse(Buffer.from("RIFFxxxx"))),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("calls generateContent with the default GA TTS model", async () => {
    const { synthesizeWithGeminiFlash } = await loadProvider();
    const result = await synthesizeWithGeminiFlash("Hola");

    expect(result.ok).toBe(true);
    expect(modelFromFetchCall()).toBe("gemini-3.8-flash-tts");
  });

  it("uses GEMINI_TTS_MODEL in the request URL", async () => {
    vi.stubEnv("GEMINI_TTS_MODEL", "custom-tts-model");
    const { synthesizeWithGeminiFlash } = await loadProvider();
    await synthesizeWithGeminiFlash("Hola");
    expect(modelFromFetchCall()).toBe("custom-tts-model");
  });

  it("skips when GOOGLE_API_KEY is missing", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    const { synthesizeWithGeminiFlash } = await loadProvider();
    const result = await synthesizeWithGeminiFlash("Hola");
    expect(result).toEqual({ ok: false, reason: "missing_GOOGLE_API_KEY" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("includes Kore prebuilt voice in speechConfig", async () => {
    const { synthesizeWithGeminiFlash } = await loadProvider();
    await synthesizeWithGeminiFlash("Hola");
    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as {
      generationConfig?: {
        speechConfig?: { voiceConfig?: { prebuiltVoiceConfig?: { voiceName?: string } } };
      };
    };
    expect(
      body.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig
        ?.voiceName,
    ).toBe("Kore");
  });
});