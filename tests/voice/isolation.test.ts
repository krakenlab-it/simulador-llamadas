import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isolateTraineeAudio,
  transcribeWithElevenLabsScribe,
} from "@/lib/voice/providers/elevenlabs";

describe("KLM-45 trainee audio isolation before Scribe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_ENABLED;
  });

  it("calls audio-isolation endpoint before speech-to-text", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_ENABLED = "true";

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("audio-isolation")) {
          return new Response(new ArrayBuffer(8), { status: 200 });
        }
        if (url.includes("speech-to-text")) {
          return new Response(JSON.stringify({ text: "hola" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const result = await transcribeWithElevenLabsScribe(
      Buffer.from("fake-audio"),
      "audio/webm",
    );

    expect(calls[0]).toContain("audio-isolation");
    expect(calls[1]).toContain("speech-to-text");
    expect(result?.transcript).toBe("hola");
  });

  it("isolateTraineeAudio hits isolation API", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_ENABLED = "true";

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response(new ArrayBuffer(4), { status: 200 });
      }),
    );

    await isolateTraineeAudio(Buffer.from("raw"), "audio/webm");
    expect(calls[0]).toContain("audio-isolation");
  });
});
