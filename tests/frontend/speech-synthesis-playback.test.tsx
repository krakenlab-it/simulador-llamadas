import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  resetClientPlaybackForTests,
  unlockClientPlayback,
} from "@/lib/voice/client-playback";

const play = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/voice-session", () => ({
  getVoiceAuthHeaders: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    sttTier: "browser",
    ttsTier: "elevenlabs",
    serverTts: true,
    serverStt: false,
    requiresVoiceAuth: true,
    convaiEnabled: false,
    ready: true,
  }),
}));

import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis";

describe("billed TTS playback", () => {
  beforeEach(() => {
    resetClientPlaybackForTests();
    play.mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      class FakeAudio {
        src = "";
        volume = 1;
        muted = false;
        preload = "";
        currentTime = 0;
        playsInline = false;
        onplay: (() => void) | null = null;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play = play;
        pause = vi.fn();
        setAttribute = vi.fn();
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "audio/mpeg" },
        blob: async () =>
          new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      }),
    );
  });

  afterEach(() => {
    resetClientPlaybackForTests();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("plays the billed audio on the shared element after unlock", async () => {
    unlockClientPlayback();
    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak("¿Ustedes miden gente real o solo leads?");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/voice/tts",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(play).toHaveBeenCalled();
  });
});
