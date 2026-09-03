import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
      }),
    },
  }),
}));

import { startBilledVoiceSession } from "@/lib/auth/voice-session";

describe("startBilledVoiceSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the browser when the start route returns 500 JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "pool timeout" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(startBilledVoiceSession("call-1")).resolves.toEqual({
      fallbackToBrowser: true,
      reason: "voice_session_start_failed",
    });
  });

  it("falls back to the browser when the start body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Internal Server Error</html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(startBilledVoiceSession("call-1")).resolves.toEqual({
      fallbackToBrowser: true,
      reason: "voice_session_start_failed",
    });
  });

  it("keeps a healthy billed session when the route returns a usage id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionUsageId: "usage-1",
            verifiedUserId: "user-1",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(startBilledVoiceSession("call-1")).resolves.toEqual({
      sessionUsageId: "usage-1",
      verifiedUserId: "user-1",
    });
  });
});
