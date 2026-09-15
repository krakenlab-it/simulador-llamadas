import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260915183000_call_attempt_agentic.sql",
);

describe("agentic session migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("adds per-call session_config for preset agentic overlays", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS session_config JSONB");
  });

  it("adds persisted agentic_state for meters and /reiniciar offset", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS agentic_state JSONB");
  });
});
