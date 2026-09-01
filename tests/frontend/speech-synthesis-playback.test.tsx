import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  resetClientPlaybackForTests,
  unlockClientPlayback,
} from "@/lib/voice/client-playback";
import { TTS_FETCH_TIMEOUT_MS } from "@/lib/voice/timeouts";

const play = vi.fn().mockResolvedValue(undefined);
const speak = vi.fn();
const cancelSynth = vi.fn();
const resumeSynth = vi.fn();
const getVoices = vi.fn(() => [{ lang: "es-MX", name: "Paulina" }]);

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
    speak.mockClear();
    cancelSynth.mockClear();
    resumeSynth.mockClear();
    vi.stubGlobal(
      "Audio",
      class FakeAudio {
        src = "";
        volume = 1;
        muted = false;
        preload = "";
        currentTime = 0;
        paused = true;
        ended = false;
        playsInline = false;
        onplay: (() => void) | null = null;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play = play;
        pause = vi.fn();
        setAttribute = vi.fn();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
      },
    );
    vi.stubGlobal("speechSynthesis", {
      speak,
      cancel: cancelSynth,
      resume: resumeSynth,
      getVoices,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class FakeUtterance {
        lang = "";
        volume = 1;
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
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

  it("clears a stuck speaking flag via watchdog so STT can resume", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    play.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak("¿Ustedes miden gente real o solo leads?");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.speaking).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(46_000);
    });

    expect(result.current.speaking).toBe(false);
    vi.useRealTimers();
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

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/voice/tts",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(play).toHaveBeenCalled();
  });

  it("falls back to browser speechSynthesis on a 502 without retrying", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    play.mockClear();
    speak.mockClear();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => "application/json" },
      blob: async () => new Blob(),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak("Eso no mueve venta por m².");
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();

    await act(async () => {
      const utterance = speak.mock.calls.at(-1)?.[0] as SpeechSynthesisUtterance;
      utterance.onend?.({} as SpeechSynthesisEvent);
    });

    expect(result.current.speaking).toBe(false);
    vi.useRealTimers();
  });

  it("falls back when the billed TTS fetch times out", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak("Hola Rodrigo.");
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(TTS_FETCH_TIMEOUT_MS + 200);
      vi.advanceTimersByTime(120);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
