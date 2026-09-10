import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  isDatabaseConfigured: () => false,
  withPgClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-voice-session", () => ({
  resolveVoiceAuth: async () => ({
    supabaseUserId: "sb-1",
    email: "preview@krakenlab.it",
    accessToken: "token",
    verifiedUserId: "sb-1",
  }),
  isVoiceAuthContext: () => true,
}));

vi.mock("@/lib/voice/gates", () => ({
  isBilledElevenLabsPathAvailable: () => true,
}));

import { POST } from "@/app/api/voice/session/start/route";

describe("POST /api/voice/session/start without usage database", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps billed TTS instead of falling back to the browser", async () => {
    const response = await POST(
      new Request("http://localhost/api/voice/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer live-session-jwt",
        },
        body: JSON.stringify({ callAttemptId: "call-1" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fallbackToBrowser: false,
      reason: "usage_db_unavailable",
      verifiedUserId: "sb-1",
    });
  });
});
