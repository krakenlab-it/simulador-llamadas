import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null =
    null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();
}

const instances: FakeRecognition[] = [];

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    sttTier: "browser",
    ttsTier: "browser",
    serverStt: false,
    serverTts: false,
    requiresVoiceAuth: false,
    convaiEnabled: false,
    ready: true,
  }),
}));

describe("speech recognition keep-alive", () => {
  beforeEach(() => {
    instances.length = 0;
    vi.stubGlobal(
      "SpeechRecognition",
      class extends FakeRecognition {
        constructor() {
          super();
          instances.push(this);
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("treats no-speech as a restart, not a visible error", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useSpeechRecognition({ keepAlive: true }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(instances).toHaveLength(1);
    expect(result.current.error).toBeNull();

    act(() => {
      instances[0].onerror?.({ error: "no-speech" });
      instances[0].onend?.();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.listening).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(instances.length).toBeGreaterThan(1);
    expect(result.current.error).toBeNull();
    vi.useRealTimers();
  });

  it("restarts after autosubmit once the mic is unpaused", async () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(
      ({ paused }) =>
        useSpeechRecognition({ keepAlive: true, paused }),
      { initialProps: { paused: false } },
    );

    await act(async () => {
      await Promise.resolve();
    });

    const first = instances[0];
    act(() => {
      first.onresult?.({
        results: [[{ transcript: "Hola, llamo de KrakenLab" }]],
      });
      first.onend?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(instances).toHaveLength(1);

    rerender({ paused: true });
    rerender({ paused: false });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(instances.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("surfaces a real microphone permission error", async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      instances[0].onerror?.({ error: "not-allowed" });
    });

    expect(result.current.error).toContain("not-allowed");
  });
});
