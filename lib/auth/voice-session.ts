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

  try {
    const response = await fetch("/api/voice/session/start", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ callAttemptId }),
    });

    if (!response.ok) {
      return { fallbackToBrowser: true, reason: "voice_session_start_failed" };
    }

    const data = (await response.json()) as {
      sessionUsageId?: string;
      verifiedUserId?: string;
      fallbackToBrowser?: boolean;
      reason?: string;
    };

    if (data.fallbackToBrowser || data.sessionUsageId) {
      return data;
    }

    return { fallbackToBrowser: true, reason: "voice_session_start_failed" };
  } catch {
    return { fallbackToBrowser: true, reason: "voice_session_start_failed" };
  }
}

export async function endBilledVoiceSession(sessionUsageId: string): Promise<void> {
  const headers = await getVoiceAuthHeaders();
  await fetch("/api/voice/session/end", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionUsageId }),
  });
}

export interface ConvaiSessionResult {
  signedUrl?: string;
  agentId?: string;
  fallbackToBrowser?: boolean;
  reason?: string;
  detail?: unknown;
}

export async function startConvaiSession(
  input: {
    sessionUsageId: string;
    clientName: string;
    scenarioContext: string;
  },
  signal?: AbortSignal,
): Promise<ConvaiSessionResult> {
  const headers = await getVoiceAuthHeaders();
  if (!headers.Authorization) {
    return { fallbackToBrowser: true, reason: "voice_auth_required" };
  }

  try {
    const response = await fetch("/api/voice/convai", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });

    const data = (await response.json()) as ConvaiSessionResult & {
      error?: string;
      detail?: unknown;
    };

    if (!response.ok) {
      return {
        fallbackToBrowser: true,
        reason: data.error ?? "convai_failed",
        detail: data.detail,
      };
    }

    if (!data.signedUrl) {
      return {
        fallbackToBrowser: true,
        reason: "missing_signed_url",
        detail: data.detail,
      };
    }

    return data;
  } catch (error) {
    if (signal?.aborted) {
      return { fallbackToBrowser: true, reason: "aborted" };
    }
    return {
      fallbackToBrowser: true,
      reason: "convai_fetch_failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
