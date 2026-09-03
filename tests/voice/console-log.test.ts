import { describe, expect, it } from "vitest";
import {
  pushVoiceConsoleEntry,
  toPublicVoiceConsoleEntry,
  voiceConsoleSummary,
} from "@/lib/voice/console-log";

describe("live-call voice console logs", () => {
  it("keeps voice.tts.attempt shape and strips secrets", () => {
    const entry = toPublicVoiceConsoleEntry({
      event: "voice.tts.attempt",
      requestId: "req-1",
      sessionUsageId: "usage-secret-should-omit",
      httpStatus: 200,
      fallbackToBrowser: false,
      languageCode: "es",
      durationMs: 180,
      charsSent: 40,
      endpoint: "convert",
      voiceIdCategory: "premade",
      apiKey: "sk_super_secret_elevenlabs_key",
    });

    expect(entry).toEqual(
      expect.objectContaining({
        event: "voice.tts.attempt",
        requestId: "req-1",
        httpStatus: 200,
        fallbackToBrowser: false,
        languageCode: "es",
      }),
    );
    expect(JSON.stringify(entry)).not.toContain("sk_");
    expect(JSON.stringify(entry)).not.toContain("usage-secret-should-omit");
    expect(JSON.stringify(entry)).not.toContain("apiKey");
  });

  it("keeps the last turn traces in order without leaking tokens", () => {
    const first = toPublicVoiceConsoleEntry({
      event: "voice.turn.submit",
      httpStatus: 200,
      roundNumber: 1,
      token: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc",
    });
    const second = toPublicVoiceConsoleEntry({
      event: "voice.tts.attempt",
      httpStatus: 502,
      fallbackToBrowser: true,
      failureReason: "synthesis_failed",
    });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const logs = pushVoiceConsoleEntry(
      pushVoiceConsoleEntry([], first!),
      second!,
    );

    expect(logs.map((item) => item.event)).toEqual([
      "voice.turn.submit",
      "voice.tts.attempt",
    ]);
    expect(voiceConsoleSummary(logs[1]!)).toMatch(/tts|navegador|502/i);
    expect(JSON.stringify(logs)).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  });
});
