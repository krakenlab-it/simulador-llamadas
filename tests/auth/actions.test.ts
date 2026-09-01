import { describe, expect, it, vi } from "vitest";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { signInWithPassword } from "@/lib/auth/actions";

function createMockClient(result: {
  error?: { message: string } | null;
  session?: Session | null;
}): SupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: result.session ?? null },
        error: result.error ?? null,
      }),
    },
  } as unknown as SupabaseClient;
}

describe("signInWithPassword", () => {
  it("returns a Spanish error on invalid credentials", async () => {
    const client = createMockClient({
      error: { message: "Invalid login credentials" },
      session: null,
    });

    const result = await signInWithPassword(
      "demo@cdc.mx",
      "wrong-password",
      () => client,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Correo o contraseña incorrectos.");
  });

  it("returns session on successful login", async () => {
    const session = {
      access_token: "token",
      user: { id: "user-1", email: "demo@cdc.mx" },
    } as Session;

    const client = createMockClient({ session });

    const result = await signInWithPassword(
      "demo@cdc.mx",
      "good-password",
      () => client,
    );

    expect(result.ok).toBe(true);
    expect(result.session).toBe(session);
  });
});
