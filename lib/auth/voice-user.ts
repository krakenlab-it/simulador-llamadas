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
