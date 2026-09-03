import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  resetClientPlaybackForTests,
  unlockClientPlayback,
} from "@/lib/voice/client-playback";
import {
  BROWSER_SPEAK_START_TIMEOUT_MS,
  SPEAKING_WATCHDOG_MS,
  TTS_FETCH_TIMEOUT_MS,
} from "@/lib/voice/timeouts";

/** Long enough for the settle delay client-playback leaves after cancel(). */
const SETTLE_MS = 100;

const SPANISH_LINE = "¿Ustedes miden gente real o solo leads?";

interface FakeUtterance {
  text: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const play = vi.fn().mockResolvedValue(undefined);
const speak = vi.fn<(utterance: FakeUtterance) => void>();
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

function spokenTexts(): string[] {
  return speak.mock.calls.map(([utterance]) => utterance.text);
}

function lastUtterance(): FakeUtterance {
  const utterance = speak.mock.calls.at(-1)?.[0];
  if (!utterance) throw new Error("browser synthesis never spoke");
  return utterance;
}

function jsonResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => "application/json" },
    blob: async () => new Blob(),
  } as unknown as Response;
}

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
      class FakeSpeechSynthesisUtterance {
        lang = "";
        volume = 1;
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
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
    // Drop timers before restoring the real clock so a failed assertion cannot
    // leak a pending utterance into the next test.
    vi.clearAllTimers();
    vi.useRealTimers();
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
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/voice/tts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(play).toHaveBeenCalled();
  });

  it.each([429, 502, 503])(
    "speaks the same Spanish line in the browser on a %i",
    async (status) => {
      vi.useFakeTimers();
      unlockClientPlayback();
      play.mockClear();
      speak.mockClear();
      vi.mocked(fetch).mockResolvedValue(jsonResponse(status));

      const { result } = renderHook(() =>
        useSpeechSynthesis({ sessionUsageId: "usage-1" }),
      );

      await act(async () => {
        result.current.speak(SPANISH_LINE);
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(SETTLE_MS);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(play).not.toHaveBeenCalled();
      expect(spokenTexts()).toEqual([SPANISH_LINE]);
      expect(result.current.speaking).toBe(true);

      await act(async () => {
        const utterance = lastUtterance();
        utterance.onstart?.();
        utterance.onend?.();
      });

      expect(result.current.speaking).toBe(false);
      vi.useRealTimers();
    },
  );

  it("retries a transient 500 once and plays billed audio when ElevenLabs is fine", async () => {
    unlockClientPlayback();
    play.mockClear();
    speak.mockClear();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(500))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "audio/mpeg" },
        blob: async () =>
          new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      } as unknown as Response);

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalled();
    expect(spokenTexts()).toEqual([]);
  });

  it("releases the mic when the browser engine stays mute on a 502", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    speak.mockClear();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(502));

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(SETTLE_MS);
    });

    // Engine never fires onstart: one retry, then hand the mic back well
    // before the 45s watchdog.
    await act(async () => {
      vi.advanceTimersByTime((BROWSER_SPEAK_START_TIMEOUT_MS + 10) * 2);
    });

    expect(speak).toHaveBeenCalledTimes(2);
    expect(result.current.speaking).toBe(false);
    vi.useRealTimers();
  });

  it("falls back when the billed TTS fetch times out", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    speak.mockClear();
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

    // The abort rejection settles on the microtask queue, so the fetch budget
    // and the settle delay have to be advanced in separate flushes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TTS_FETCH_TIMEOUT_MS + 200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(spokenTexts()).toEqual(["Hola Rodrigo."]);
    vi.useRealTimers();
  });

  it("speaks the line when billed audio arrives but will not play", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    speak.mockClear();
    play.mockRejectedValue(new Error("NotAllowedError"));

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(play).toHaveBeenCalled();
    expect(spokenTexts()).toEqual([SPANISH_LINE]);
    vi.useRealTimers();
  });

  it("keeps the mic held until the browser fallback finishes", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(502));

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
    await act(async () => {
      lastUtterance().onstart?.();
    });

    expect(result.current.speaking).toBe(true);
    vi.useRealTimers();
  });

  it("stops the browser fallback and frees the mic on cancel", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(502));

    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(SETTLE_MS);
    });

    const stale = lastUtterance();
    await act(async () => {
      result.current.cancel();
    });

    expect(cancelSynth).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);

    // A late event from the cancelled utterance must not disturb the flag.
    await act(async () => {
      stale.onend?.();
    });
    expect(result.current.speaking).toBe(false);
    vi.useRealTimers();
  });

  it("clears a stuck speaking flag via watchdog so STT can resume", async () => {
    vi.useFakeTimers();
    unlockClientPlayback();
    play.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() =>
      useSpeechSynthesis({ sessionUsageId: "usage-1" }),
    );

    await act(async () => {
      result.current.speak(SPANISH_LINE);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.speaking).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(SPEAKING_WATCHDOG_MS + 1_000);
    });

    expect(result.current.speaking).toBe(false);
    vi.useRealTimers();
  });
});
