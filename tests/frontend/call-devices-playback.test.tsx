import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCallSpeaker,
  getSharedCallAudio,
  resetClientPlaybackForTests,
} from "@/lib/voice/client-playback";

describe("call speaker output", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Audio",
      class FakeAudio {
        src = "";
        volume = 1;
        muted = false;
        preload = "";
        currentTime = 0;
        sinkId = "";
        setSinkId = vi.fn(async (deviceId: string) => {
          this.sinkId = deviceId;
        });
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        setAttribute = vi.fn();
      },
    );
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "speaker-1"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    resetClientPlaybackForTests();
  });

  afterEach(() => {
    resetClientPlaybackForTests();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("routes billed playback through setSinkId on the shared audio element", async () => {
    await applyCallSpeaker("speaker-1");
    const audio = getSharedCallAudio();
    expect(audio?.setSinkId).toHaveBeenCalledWith("speaker-1");
    expect(audio?.sinkId).toBe("speaker-1");
  });
});
