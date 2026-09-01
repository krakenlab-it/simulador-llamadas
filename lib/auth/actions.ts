import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/auth/errors";

export type AuthClientFactory = () => SupabaseClient;

export interface AuthActionResult {
  ok: boolean;
  session?: Session | null;
  error?: string;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  createClient: AuthClientFactory = createBrowserSupabaseClient,
): Promise<AuthActionResult> {
  try {
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { ok: false, error: mapAuthError(error.message) };
    }

    if (data.session) {
      return { ok: true, session: data.session };
    }

    // When "Confirm email" is disabled in Supabase, sign-up may still omit session.
    const signIn = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signIn.error || !signIn.data.session) {
      return {
        ok: false,
        error:
          "Registro creado pero no hay sesión activa. Desactiva «Confirm email» en Supabase (Proveedor Email) e inténtalo de nuevo.",
      };
    }

    return { ok: true, session: signIn.data.session };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? mapAuthError(error.message)
          : "No se pudo crear la cuenta.",
    };
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
  createClient: AuthClientFactory = createBrowserSupabaseClient,
): Promise<AuthActionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.session) {
      return {
        ok: false,
        error: mapAuthError(error?.message ?? "invalid login credentials"),
      };
    }

    return { ok: true, session: data.session };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? mapAuthError(error.message)
          : "No se pudo iniciar sesión.",
    };
  }
}

export async function signOut(
  createClient: AuthClientFactory = createBrowserSupabaseClient,
): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
