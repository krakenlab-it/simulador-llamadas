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

  it("does not demote to browser when the start route returns 500 JSON", async () => {
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
      fallbackToBrowser: false,
      reason: "voice_session_unavailable",
    });
  });

  it("does not demote to browser when the start body is not JSON", async () => {
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
      fallbackToBrowser: false,
      reason: "voice_session_unavailable",
    });
  });

  it("keeps billed TTS when usage DB is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            fallbackToBrowser: false,
            reason: "usage_db_unavailable",
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
      fallbackToBrowser: false,
      reason: "usage_db_unavailable",
      verifiedUserId: "user-1",
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
