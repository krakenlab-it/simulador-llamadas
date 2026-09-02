import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** First migration that relaxes the v1 three-scenario limit (custom scenarios). */
export const RELAX_THREE_SCENARIO_LIMIT_FILE =
  "20250831000003_relax_three_scenario_limit.sql";

export const TRAINEE_IDENTITY_MIGRATION_FILE =
  "20250902000000_trainee_identity.sql";

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export function loadMigrationSql(): string {
  return listMigrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

/** Clinic v1 schema only (through 000002) — preserves PR #4 three-scenario trigger tests. */
export function loadClinicV1MigrationSql(): string {
  return listMigrationFiles()
    .filter((f) => f < RELAX_THREE_SCENARIO_LIMIT_FILE)
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

export function loadRelaxThreeScenarioLimitMigrationSql(): string {
  return readFileSync(
    join(MIGRATIONS_DIR, RELAX_THREE_SCENARIO_LIMIT_FILE),
    "utf-8",
  );
}

export async function resetAndMigrate(client: Client): Promise<void> {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.query(loadClinicV1MigrationSql());
}

export async function resetAndMigrateAll(client: Client): Promise<void> {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.query(loadMigrationSql());
}

export async function ensureMigrated(client: Client): Promise<void> {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'scenarios'
       AND column_name IN ('is_preset', 'voice_agent')`,
  );

  const columns = new Set(rows.map((row) => row.column_name));
  if (!columns.has("is_preset") || !columns.has("voice_agent")) {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await client.query(loadMigrationSql());
    return;
  }

  const index = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'trainees_email_lower_uidx'`,
  );
  if (index.rows.length === 0) {
    await client.query(
      readFileSync(join(MIGRATIONS_DIR, TRAINEE_IDENTITY_MIGRATION_FILE), "utf-8"),
    );
  }
}
