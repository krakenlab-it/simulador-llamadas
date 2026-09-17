import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const withPgClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/session", () => ({
  isDatabaseConfigured: () => false,
  withPgClient: (...args: unknown[]) => withPgClient(...args),
}));

import {
  isVoiceAuthContext,
  resolveVoiceAuth,
  verifySupabaseAccessToken,
} from "@/lib/auth/require-voice-session";

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

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

  it("uses JWT claims when getUser returns no user for an unconfirmed email", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });
    const token = unsignedJwt({
      sub: "user-9",
      email: "seb@krakenlab.it",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(verifySupabaseAccessToken(token)).resolves.toEqual({
      userId: "user-9",
      email: "seb@krakenlab.it",
    });
  });
});

describe("resolveVoiceAuth without usage database", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    getUser.mockReset();
    withPgClient.mockReset();
  });

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  });

  it("returns a JWT identity without touching Postgres", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "preview-user",
          email: "preview@krakenlab.it",
          email_confirmed_at: null,
        },
      },
    });

    const result = await resolveVoiceAuth(
      new Request("https://example.com/api/voice/tts", {
        headers: { authorization: "Bearer live-session-jwt" },
      }),
    );

    expect(isVoiceAuthContext(result)).toBe(true);
    if (!isVoiceAuthContext(result)) return;
    expect(result).toEqual({
      supabaseUserId: "preview-user",
      email: "preview@krakenlab.it",
      accessToken: "live-session-jwt",
      verifiedUserId: "preview-user",
    });
    expect(withPgClient).not.toHaveBeenCalled();
  });
});
