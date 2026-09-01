import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("synthesizeWithElevenLabs", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-123");
    vi.stubEnv("ELEVENLABS_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses eleven_flash_v2_5 with ISO 639-1 Spanish for streaming TTS", async () => {
    const { synthesizeWithElevenLabs } = await import(
      "@/lib/voice/providers/elevenlabs"
    );

    const result = await synthesizeWithElevenLabs("Eso no mueve venta por m².");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/v1/text-to-speech/voice-123/stream");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      text: "Eso no mueve venta por m².",
      model_id: "eleven_flash_v2_5",
      language_code: "es",
    });
  });
});
