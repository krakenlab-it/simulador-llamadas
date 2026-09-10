import { describe, expect, it } from "vitest";
import {
  resolveVoiceUserIdentity,
  resolveVoiceUserIdentityFromJwt,
} from "@/lib/auth/voice-user";

describe("resolveVoiceUserIdentity — billed voice does not require email confirmation", () => {
  it("accepts a valid session user whose email is not confirmed", () => {
    const identity = resolveVoiceUserIdentity({
      id: "user-1",
      email: "sebastian@krakenlab.it",
      email_confirmed_at: null,
    });

    expect(identity).toEqual({
      userId: "user-1",
      email: "sebastian@krakenlab.it",
    });
  });

  it("uses identity or metadata email when user.email is missing", () => {
    const identity = resolveVoiceUserIdentity({
      id: "user-2",
      email: null,
      email_confirmed_at: null,
      user_metadata: { email: "From.Meta@Example.com" },
      identities: [{ identity_data: { email: "identity@example.com" } }],
    });

    expect(identity).toEqual({
      userId: "user-2",
      email: "from.meta@example.com",
    });
  });

  it("reads identity from a live JWT when getUser omitted the user", () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-jwt",
        email: "Sebastian@Krakenlab.it",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const token = `eyJhbGciOiJub25lIn0.${payload}.sig`;

    expect(resolveVoiceUserIdentityFromJwt(token)).toEqual({
      userId: "user-jwt",
      email: "sebastian@krakenlab.it",
    });
  });

  it("rejects an expired JWT payload", () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-jwt",
        email: "sebastian@krakenlab.it",
        exp: Math.floor(Date.now() / 1000) - 10,
      }),
    ).toString("base64url");

    expect(resolveVoiceUserIdentityFromJwt(`x.${payload}.sig`)).toBeNull();
  });

  it("rejects tokens that have no user id or email", () => {
    expect(
      resolveVoiceUserIdentity({
        id: "",
        email: "nobody@example.com",
      }),
    ).toBeNull();
    expect(
      resolveVoiceUserIdentity({
        id: "user-3",
        email: null,
        user_metadata: {},
        identities: [],
      }),
    ).toBeNull();
  });
});
