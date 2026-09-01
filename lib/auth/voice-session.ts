import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Returns Authorization header from active Supabase session, or empty. */
export async function getVoiceAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Register verified voice user — requires live Supabase session JWT (email+password). */
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
  if (response.status >= 500) return null;
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
