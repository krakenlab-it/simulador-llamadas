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

/** Returns Authorization header from active Supabase session, or null. */
export async function getVoiceAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function sendVoiceMagicLink(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
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
  accessToken?: string;
}> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user.email || !data.session.access_token) {
      return { verified: false };
    }
    const email = data.session.user.email;
    setStoredVoiceEmail(email);
    return {
      verified: true,
      email,
      accessToken: data.session.access_token,
    };
  } catch {
    return { verified: false };
  }
}

/** Register verified user — requires live Supabase session JWT. */
export async function registerVerifiedVoiceUser(): Promise<{
  verifiedUserId: string;
  email: string;
} | null> {
  const headers = await getVoiceAuthHeaders();
  if (!headers.Authorization) return null;

  const response = await fetch("/api/voice/auth/verify", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ verifiedUserId: string; email: string }>;
}

export async function startBilledVoiceSession(
  callAttemptId?: string,
): Promise<{
  sessionUsageId?: string;
  verifiedUserId?: string;
  fallbackToBrowser?: boolean;
  reason?: string;
}> {
  const headers = await getVoiceAuthHeaders();
  if (!headers.Authorization) {
    return { fallbackToBrowser: true, reason: "voice_auth_required" };
  }

  const response = await fetch("/api/voice/session/start", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ callAttemptId }),
  });
  return response.json() as Promise<{
    sessionUsageId?: string;
    verifiedUserId?: string;
    fallbackToBrowser?: boolean;
    reason?: string;
  }>;
}

export async function endBilledVoiceSession(sessionUsageId: string): Promise<void> {
  const headers = await getVoiceAuthHeaders();
  await fetch("/api/voice/session/end", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionUsageId }),
  });
}

export async function startConvaiSession(input: {
  sessionUsageId: string;
  clientName: string;
  scenarioContext: string;
}): Promise<{ signedUrl?: string; fallbackToBrowser?: boolean; reason?: string }> {
  const headers = await getVoiceAuthHeaders();
  if (!headers.Authorization) {
    return { fallbackToBrowser: true, reason: "voice_auth_required" };
  }

  const response = await fetch("/api/voice/convai", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.json() as Promise<{
    signedUrl?: string;
    fallbackToBrowser?: boolean;
    reason?: string;
  }>;
}
