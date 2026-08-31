import { Client } from "pg";

export { SessionRepository } from "./repository";
export type {
  CreateSessionInput,
  EndSessionResult,
  HistoryEntry,
  SessionRecord,
  TurnRecord,
} from "./repository";
export { SessionService, createTrainee, evaluateCloseWinFromScore } from "./service";

let sharedClient: Client | null = null;

export function getPgClient(): Client {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for server-side session persistence.");
  }

  if (!sharedClient) {
    sharedClient = new Client({ connectionString: databaseUrl });
  }

  return sharedClient;
}

export async function withPgClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = getPgClient();
  const needsConnect =
    (client as Client & { _connected?: boolean })._connected !== true;

  if (needsConnect) {
    await client.connect();
    (client as Client & { _connected?: boolean })._connected = true;
  }

  return fn(client);
}
