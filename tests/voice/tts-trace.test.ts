import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTtsRequestId,
  logTtsAttempt,
  parseElevenLabsErrorCode,
  resolveVoiceIdCategory,
  type TtsAttemptLog,
} from "@/lib/voice/tts-trace";
import { ELEVENLABS_DEFAULT_PREMADE_VOICE } from "@/lib/voice/providers/elevenlabs";

function parseLoggedAttempt(call: unknown[]): TtsAttemptLog {
  const raw = call[0];
  expect(typeof raw).toBe("string");
  return JSON.parse(String(raw)) as TtsAttemptLog;
}

describe("tts-trace", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createTtsRequestId returns a UUID", () => {
    expect(createTtsRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("logTtsAttempt emits one JSON line with the required shape", () => {
    logTtsAttempt({
      requestId: "req-1",
      sessionUsageId: "usage-1",
      turnId: "turn-1",
      voiceIdCategory: "library",
      endpoint: "convert",
      httpStatus: 402,
      elevenlabsErrorCode: "paid_plan_required",
      failureReason: "elevenlabs_http_error",
      charsRequested: 120,
      charsSent: 80,
      sessionExtraTtsRemaining: 720,
      fallbackToBrowser: true,
      durationMs: 412,
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = parseLoggedAttempt(infoSpy.mock.calls[0]!);
    expect(payload).toEqual({
      event: "voice.tts.attempt",
      requestId: "req-1",
      sessionUsageId: "usage-1",
      turnId: "turn-1",
      voiceIdCategory: "library",
      endpoint: "convert",
      httpStatus: 402,
      elevenlabsErrorCode: "paid_plan_required",
      failureReason: "elevenlabs_http_error",
      charsRequested: 120,
      charsSent: 80,
      sessionExtraTtsRemaining: 720,
      fallbackToBrowser: true,
      durationMs: 412,
    });
    expect(JSON.stringify(payload)).not.toContain("sk_");
  });

  it("resolveVoiceIdCategory distinguishes library from premade Sarah", () => {
    expect(
      resolveVoiceIdCategory("library-voice-99", ELEVENLABS_DEFAULT_PREMADE_VOICE.id),
    ).toBe("premade");
    expect(resolveVoiceIdCategory("library-voice-99", "library-voice-99")).toBe(
      "library",
    );
  });

  it("parseElevenLabsErrorCode extracts detail.status without secrets", () => {
    expect(
      parseElevenLabsErrorCode(
        '{"detail":{"status":"paid_plan_required","message":"Free users cannot use library voices via the API."}}',
      ),
    ).toBe("paid_plan_required");
  });
});
