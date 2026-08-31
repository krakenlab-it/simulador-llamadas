import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export function loadMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

export async function resetAndMigrate(client: Client): Promise<void> {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.query(loadMigrationSql());
}

export async function ensureMigrated(client: Client): Promise<void> {
  const { rows } = await client.query<{ scenarios: string | null }>(
    "SELECT to_regclass('public.scenarios') AS scenarios",
  );

  if (!rows[0].scenarios) {
    await client.query(loadMigrationSql());
  }
}
