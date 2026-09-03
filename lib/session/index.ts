import { Pool, type PoolClient } from "pg";

export { SessionRepository } from "./repository";
export type {
  CreateSessionInput,
  EndSessionResult,
  HistoryEntry,
  SessionDetail,
  SessionDetailTurn,
  SessionRecord,
  TurnRecord,
  TurnScoreInput,
  TurnSlot,
} from "./repository";
export { durationSecondsBetween, formatDurationLabel } from "./duration";
export { SessionError, toSessionError, toPublicRouteError } from "./errors";
export type { SessionErrorCode } from "./errors";
export {
  SessionService,
  createTrainee,
  findOrCreateTrainee,
  findTraineeId,
  normalizeTraineeEmail,
  evaluateCloseWinFromScore,
  resolveEndSessionWin,
  utteranceHasDay,
  utteranceHasTime,
} from "./service";
export type { TraineeIdentity } from "./service";
export type { EndSessionTurnInput } from "./service";

let sharedPool: Pool | null = null;

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for server-side session persistence.");
  }

  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: databaseUrl });
  }

  return sharedPool;
}

export async function withPgClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
