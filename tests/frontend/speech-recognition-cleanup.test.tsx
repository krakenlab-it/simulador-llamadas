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
const mockTracks: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
let openMicCaptureStream: ReturnType<typeof vi.fn>;

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

vi.mock("@/lib/voice/call-devices", () => ({
  openMicCaptureStream: (...args: unknown[]) => openMicCaptureStream(...args),
}));

function makeTrack() {
  const track = { stop: vi.fn() };
  mockTracks.push(track);
  return track;
}

function makeStream() {
  makeTrack();
  return { getTracks: () => mockTracks } as unknown as MediaStream;
}

describe("speech recognition mic cleanup", () => {
  beforeEach(() => {
    instances.length = 0;
    mockTracks.length = 0;
    openMicCaptureStream = vi.fn(async () => makeStream());
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

  it("stops every capture track when stopListening runs", async () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ keepAlive: true }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(openMicCaptureStream).toHaveBeenCalled();
      expect(mockTracks.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.stopListening();
    });

    for (const track of mockTracks) {
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("stops capture tracks when keepAlive goes false", async () => {
    const { rerender } = renderHook(
      ({ keepAlive }) => useSpeechRecognition({ keepAlive }),
      { initialProps: { keepAlive: true } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(mockTracks.length).toBeGreaterThan(0);
    });

    rerender({ keepAlive: false });

    for (const track of mockTracks) {
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("does not leave a live stream after unmount", async () => {
    vi.useFakeTimers();
    let resolveCapture: (stream: MediaStream) => void = () => undefined;
    openMicCaptureStream.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    const { unmount } = renderHook(() =>
      useSpeechRecognition({ keepAlive: true }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    const lateTrack = makeTrack();
    await act(async () => {
      resolveCapture({ getTracks: () => [lateTrack] } as unknown as MediaStream);
      await Promise.resolve();
    });

    expect(lateTrack.stop).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(instances).toHaveLength(1);
    vi.useRealTimers();
  });

  it("clears restart timers after stopListening so the mic is not reopened", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useSpeechRecognition({ keepAlive: true }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      instances[0].onerror?.({ error: "no-speech" });
      instances[0].onend?.();
    });

    act(() => {
      result.current.stopListening();
    });

    const startedBefore = instances.length;
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(instances.length).toBe(startedBefore);
    vi.useRealTimers();
  });
});
