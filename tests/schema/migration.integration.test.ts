import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const databaseUrl = process.env.DATABASE_URL;

function loadMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("schema migration (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(loadMigrationSql());
  });

  afterAll(async () => {
    await client?.end();
  });

  it("creates expected tables", async () => {
    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "trainees",
        "scenarios",
        "call_attempts",
        "call_turns",
        "turn_scores",
      ]),
    );
  });

  it("seeds exactly three scenarios", async () => {
    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM scenarios",
    );
    expect(Number(rows[0].count)).toBe(3);
  });

  it("rejects invalid difficulty level on insert", async () => {
    const trainee = await client.query<{ id: string }>(
      "INSERT INTO trainees (display_name) VALUES ('Test Trainee') RETURNING id",
    );
    const scenario = await client.query<{ id: string }>(
      "SELECT id FROM scenarios ORDER BY sort_order LIMIT 1",
    );

    await expect(
      client.query(
        `INSERT INTO call_attempts (trainee_id, scenario_id, difficulty_level, mode)
         VALUES ($1, $2, 4, 'texto')`,
        [trainee.rows[0].id, scenario.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("exposes call_history view with seeded data shape", async () => {
    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'call_history'
    `);
    const columns = rows.map((r) => r.column_name as string);
    expect(columns).toEqual(
      expect.arrayContaining([
        "call_attempt_id",
        "trainee_id",
        "scenario_slug",
        "client_name",
        "difficulty_level",
        "won",
        "total_score",
      ]),
    );
  });
});
