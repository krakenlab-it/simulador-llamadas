import { describe, expect, it } from "vitest";
import { resolveVoiceUserIdentity } from "@/lib/auth/voice-user";

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
