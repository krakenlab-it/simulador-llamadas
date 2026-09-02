import type { Client } from "pg";

export interface TraineeIdentity {
  traineeId?: string | null;
  email?: string | null;
  authUserId?: string | null;
  displayName?: string | null;
}

const PG_UNIQUE_VIOLATION = "23505";

export function normalizeTraineeEmail(
  email?: string | null,
): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

const AUTH_USER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeAuthUserId(authUserId?: string | null): string | null {
  const trimmed = authUserId?.trim() ?? "";
  return AUTH_USER_UUID.test(trimmed) ? trimmed : null;
}

function resolveDisplayName(
  identity: TraineeIdentity,
  email: string | null,
): string {
  const named = identity.displayName?.trim();
  if (named) return named;
  if (email?.includes("@")) return email.split("@")[0] ?? "Trainee";
  return "Trainee";
}

export async function findTraineeId(
  client: Client,
  identity: TraineeIdentity,
): Promise<string | null> {
  if (identity.traineeId) {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM trainees WHERE id = $1",
      [identity.traineeId],
    );
    if (rows[0]) return rows[0].id;
  }

  const authUserId = normalizeAuthUserId(identity.authUserId);
  if (authUserId) {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM trainees WHERE auth_user_id = $1",
      [authUserId],
    );
    if (rows[0]) return rows[0].id;
  }

  const email = normalizeTraineeEmail(identity.email);
  if (email) {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM trainees WHERE lower(email) = $1",
      [email],
    );
    if (rows[0]) return rows[0].id;
  }

  return null;
}

async function attachIdentity(
  client: Client,
  traineeId: string,
  identity: TraineeIdentity,
): Promise<void> {
  const email = normalizeTraineeEmail(identity.email);
  const authUserId = normalizeAuthUserId(identity.authUserId);
  if (!email && !authUserId) return;

  await client.query(
    `UPDATE trainees
     SET email = COALESCE(email, $2),
         auth_user_id = COALESCE(auth_user_id, $3::uuid),
         updated_at = now()
     WHERE id = $1`,
    [traineeId, email, authUserId],
  );
}

export async function findOrCreateTrainee(
  client: Client,
  identity: TraineeIdentity,
): Promise<string> {
  const existing = await findTraineeId(client, identity);
  if (existing) {
    await attachIdentity(client, existing, identity);
    return existing;
  }

  const email = normalizeTraineeEmail(identity.email);
  const authUserId = normalizeAuthUserId(identity.authUserId);
  const displayName = resolveDisplayName(identity, email);

  try {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO trainees (display_name, email, auth_user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [displayName, email, authUserId],
    );
    return rows[0].id;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
    if (code === PG_UNIQUE_VIOLATION) {
      const raced = await findTraineeId(client, identity);
      if (raced) {
        await attachIdentity(client, raced, identity);
        return raced;
      }
    }
    throw error;
  }
}
