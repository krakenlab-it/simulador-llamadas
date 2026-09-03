import { afterEach, describe, expect, it } from "vitest";
import {
  isElevenLabsEnabled,
  SESSION_CONVAI_MAX_SECONDS,
  SESSION_CONVAI_WARN_REMAINING_SECONDS,
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_TTS_MAX_CHARS_PER_TURN,
  SESSION_MAX_ROUNDS,
  SESSION_MAX_TURN_ALLOCATIONS,
  DAILY_BILLED_SESSIONS_PER_USER,
  GLOBAL_MAX_CONCURRENT_CONVAI,
  GLOBAL_MONTHLY_CONVAI_MINUTES,
  GLOBAL_MONTHLY_CONVAI_MAX_SECONDS,
} from "@/lib/voice/brakes";
import { isBilledElevenLabsPathAvailable } from "@/lib/voice/gates";

const ENV_KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_ENABLED"] as const;

function clearBrakeEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("KLM-45 spend brakes — locked constants", () => {
  it("keeps ConvAI lock and paid-plan demo TTS caps", () => {
    expect(SESSION_CONVAI_MAX_SECONDS).toBe(180);
    expect(SESSION_CONVAI_WARN_REMAINING_SECONDS).toBe(30);
    expect(SESSION_MAX_ROUNDS).toBe(5);
    expect(SESSION_MAX_TURN_ALLOCATIONS).toBeGreaterThan(SESSION_MAX_ROUNDS);
    expect(SESSION_EXTRA_TTS_MAX_CHARS).toBe(4000);
    expect(SESSION_TTS_MAX_CHARS_PER_TURN).toBe(480);
    expect(DAILY_BILLED_SESSIONS_PER_USER).toBe(10);
    expect(GLOBAL_MAX_CONCURRENT_CONVAI).toBe(2);
    expect(GLOBAL_MONTHLY_CONVAI_MINUTES).toBe(300);
    expect(GLOBAL_MONTHLY_CONVAI_MAX_SECONDS).toBe(18_000);
  });
});

describe("KLM-45 kill switch ELEVENLABS_ENABLED", () => {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("disables billed path when ELEVENLABS_ENABLED=false even with key", () => {
    clearBrakeEnv();
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_ENABLED = "false";
    expect(isElevenLabsEnabled()).toBe(false);
    expect(isBilledElevenLabsPathAvailable()).toBe(false);
  });

  it("enables billed path when key is set and kill switch is not false", () => {
    clearBrakeEnv();
    process.env.ELEVENLABS_API_KEY = "test-key";
    expect(isElevenLabsEnabled()).toBe(true);
    expect(isBilledElevenLabsPathAvailable()).toBe(true);
  });
});
