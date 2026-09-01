import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/lib/auth/voice-session", () => ({
  startBilledVoiceSession: vi.fn().mockResolvedValue({
    sessionUsageId: "usage-1",
    verifiedUserId: "user-1",
  }),
  endBilledVoiceSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/hooks/useConvaiConnection", () => ({
  voiceSessionFetch: vi.fn(),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({ requiresVoiceAuth: true, convaiEnabled: false }),
}));

import { useVoiceSession } from "@/lib/hooks/useVoiceSession";
import { voiceSessionFetch } from "@/lib/hooks/useConvaiConnection";

function usageResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ remainingConvaiSeconds: 180, warnLowTime: false }),
  } as Response;
}

function convaiTicks(): number {
  return vi
    .mocked(voiceSessionFetch)
    .mock.calls.filter(([, init]) =>
      String(init?.body ?? "").includes("convaiSeconds"),
    ).length;
}

describe("billed voice session metering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(voiceSessionFetch).mockResolvedValue(usageResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function settle(ms = 0): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("does not spend ConvAI seconds while the call runs on browser mic + TTS", async () => {
    const { result } = renderHook(() =>
      useVoiceSession("user-1", "call-1", "voz", { meterConvaiSeconds: false }),
    );

    await settle();
    expect(result.current.sessionUsageId).toBe("usage-1");

    await settle(10_000);

    // The ConvAI budget also gates ElevenLabs TTS, so an idle meter would cut
    // the client's voice mid-call.
    expect(convaiTicks()).toBe(0);
  });

  it("spends ConvAI seconds once the agent carries the audio", async () => {
    const { result } = renderHook(() =>
      useVoiceSession("user-1", "call-1", "voz", { meterConvaiSeconds: true }),
    );

    await settle();
    expect(result.current.sessionUsageId).toBe("usage-1");

    await settle(3_000);

    expect(convaiTicks()).toBeGreaterThan(0);
  });
});
