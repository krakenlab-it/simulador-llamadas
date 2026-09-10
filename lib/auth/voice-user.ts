export interface VoiceUserLike {
  id?: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: { email?: unknown } | null;
  identities?: Array<{ identity_data?: { email?: unknown } | null }> | null;
}

export interface VoiceUserIdentity {
  userId: string;
  email: string;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Identify a billed-voice user from a live Supabase session.
 * Email confirmation is not required — a valid user id + email is enough.
 */
export function resolveVoiceUserIdentity(
  user: VoiceUserLike,
): VoiceUserIdentity | null {
  const userId = user.id?.trim();
  if (!userId) return null;

  const fromIdentity = user.identities
    ?.map((identity) => normalizeEmail(identity.identity_data?.email))
    .find((email): email is string => Boolean(email));

  const email =
    normalizeEmail(user.email) ??
    normalizeEmail(user.user_metadata?.email) ??
    fromIdentity ??
    null;

  if (!email) return null;
  return { userId, email };
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Last-resort identity from a live access token when Auth getUser omits the
 * user (common for “Email not confirmed”). Signature is not re-checked here;
 * callers must already have a token that Auth issued for this project.
 */
export function resolveVoiceUserIdentityFromJwt(
  accessToken: string,
): VoiceUserIdentity | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }

  const metadata =
    payload.user_metadata && typeof payload.user_metadata === "object"
      ? (payload.user_metadata as { email?: unknown })
      : null;

  return resolveVoiceUserIdentity({
    id: typeof payload.sub === "string" ? payload.sub : null,
    email: typeof payload.email === "string" ? payload.email : null,
    user_metadata: metadata,
  });
}
