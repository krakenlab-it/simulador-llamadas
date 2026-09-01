import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { loadMigrationSql } from "../helpers/db";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20250901000000_atomic_turn_allocation.sql",
);

describe("atomic turn allocation migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("adds a client idempotency key with a unique index per attempt", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS client_turn_id UUID");
    expect(sql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_call_turns_attempt_client_turn",
    );
  });

  it("persists the client reply so a replayed turn can be spoken again", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS client_reply TEXT");
  });

  it("allocates the round number under a lock on the parent attempt", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION allocate_call_turn");
    expect(sql).toContain("FROM call_attempts ca");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("COALESCE(v_round, 0::SMALLINT) + 1");
  });

  it("reports every outcome as a status instead of raising to the client", () => {
    for (const status of [
      "reserved",
      "replay",
      "not_found",
      "not_in_progress",
      "rounds_exhausted",
    ]) {
      expect(sql).toContain(`'${status}'::TEXT`);
    }
  });
});

describe("call_turns duplicate protection is still in the schema", () => {
  const sql = loadMigrationSql();

  it("keeps the unique (call_attempt_id, round_number) safety net", () => {
    expect(sql).toContain("UNIQUE (call_attempt_id, round_number)");
  });
});
