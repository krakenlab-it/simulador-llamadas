import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvaiConnection } from "@/lib/hooks/useConvaiConnection";

vi.mock("@elevenlabs/client", () => ({
  Conversation: {
    startSession: vi.fn(),
  },
}));

vi.mock("@/lib/auth/voice-session", () => ({
  getVoiceAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test" }),
  startConvaiSession: vi.fn(),
}));

import { Conversation } from "@elevenlabs/client";
import { startConvaiSession } from "@/lib/auth/voice-session";

describe("useConvaiConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not retry after a failed convai session request", async () => {
    vi.mocked(startConvaiSession).mockResolvedValue({
      fallbackToBrowser: true,
      reason: "convai_unavailable",
    });

    const onFallback = vi.fn();

    const { result, rerender } = renderHook(
      (props) => useConvaiConnection(props),
      {
        initialProps: {
          sessionUsageId: "sess-1",
          clientName: "Mariana Escobedo",
          scenarioContext: "context",
          enabled: true,
          onFallback,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });

    expect(startConvaiSession).toHaveBeenCalledTimes(1);
    expect(Conversation.startSession).not.toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledWith("convai_unavailable");

    rerender({
      sessionUsageId: "sess-1",
      clientName: "Mariana Escobedo",
      scenarioContext: "context",
      enabled: true,
      onFallback,
    });

    await waitFor(() => {
      expect(startConvaiSession).toHaveBeenCalledTimes(1);
    });
  });

  it("starts one ElevenLabs session when signed URL is returned", async () => {
    const endSession = vi.fn().mockResolvedValue(undefined);
    vi.mocked(startConvaiSession).mockResolvedValue({
      signedUrl: "wss://example.test/convai",
    });
    vi.mocked(Conversation.startSession).mockResolvedValue({
      endSession,
    } as never);

    const onUserTranscript = vi.fn();

    const { result, unmount } = renderHook(() =>
      useConvaiConnection({
        sessionUsageId: "sess-2",
        clientName: "Mariana Escobedo",
        scenarioContext: "context",
        enabled: true,
        onUserTranscript,
      }),
    );

    await waitFor(() => {
      expect(Conversation.startSession).toHaveBeenCalledTimes(1);
    });

    expect(Conversation.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        signedUrl: "wss://example.test/convai",
        connectionType: "websocket",
      }),
    );

    const startArgs = vi.mocked(Conversation.startSession).mock.calls[0]?.[0];
    startArgs?.onMessage?.({
      message: "Hola, buen día",
      source: "user",
      role: "user",
    });
    expect(onUserTranscript).toHaveBeenCalledWith("Hola, buen día");

    unmount();
    await waitFor(() => {
      expect(endSession).toHaveBeenCalled();
    });
    expect(result.current.connected).toBe(false);
  });
});
