import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const VOICE_EMAIL_KEY = "simulador:voice-verified-email";

export function getStoredVoiceEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VOICE_EMAIL_KEY);
}

export function setStoredVoiceEmail(email: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOICE_EMAIL_KEY, email.trim().toLowerCase());
}

export function clearStoredVoiceEmail(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VOICE_EMAIL_KEY);
}

export async function sendVoiceMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/?voice_auth=1`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo enviar el enlace.",
    };
  }
}

export async function verifyVoiceSession(): Promise<{
  verified: boolean;
  email?: string;
}> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user.email) {
      return { verified: false };
    }
    const email = data.session.user.email;
    setStoredVoiceEmail(email);
    return { verified: true, email };
  } catch {
    return { verified: false };
  }
}

export async function registerVerifiedVoiceUser(
  email: string,
  authUserId?: string,
): Promise<{ verifiedUserId: string } | null> {
  const response = await fetch("/api/voice/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, authUserId }),
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ verifiedUserId: string }>;
}

export async function startBilledVoiceSession(
  verifiedUserId: string,
  callAttemptId?: string,
): Promise<{
  sessionUsageId?: string;
  fallbackToBrowser?: boolean;
  reason?: string;
}> {
  const response = await fetch("/api/voice/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verifiedUserId, callAttemptId }),
  });
  return response.json() as Promise<{
    sessionUsageId?: string;
    fallbackToBrowser?: boolean;
    reason?: string;
  }>;
}

export async function endBilledVoiceSession(sessionUsageId: string): Promise<void> {
  await fetch("/api/voice/session/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionUsageId }),
  });
}
