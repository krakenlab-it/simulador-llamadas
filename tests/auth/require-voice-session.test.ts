import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser },
  }),
}));

import { verifySupabaseAccessToken } from "@/lib/auth/require-voice-session";

describe("verifySupabaseAccessToken", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    getUser.mockReset();
  });

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  });

  it("accepts a live session JWT even when the email is not confirmed", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "preview@krakenlab.it",
          email_confirmed_at: null,
        },
      },
      error: { message: "Email not confirmed" },
    });

    await expect(verifySupabaseAccessToken("valid-jwt")).resolves.toEqual({
      userId: "user-1",
      email: "preview@krakenlab.it",
    });
  });

  it("still rejects an invalid or empty session token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid claim: missing sub" },
    });

    await expect(verifySupabaseAccessToken("bad-jwt")).resolves.toBeNull();
  });
});
