import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  RELAX_THREE_SCENARIO_LIMIT_FILE,
  loadRelaxThreeScenarioLimitMigrationSql,
} from "../helpers/db";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  RELAX_THREE_SCENARIO_LIMIT_FILE,
);

describe("relax three scenario limit migration (static)", () => {
  const sql = loadRelaxThreeScenarioLimitMigrationSql();

  it("is a named migration file (not an edit to the original seed)", () => {
    expect(RELAX_THREE_SCENARIO_LIMIT_FILE).toBe(
      "20250831000003_relax_three_scenario_limit.sql",
    );
    expect(readFileSync(MIGRATION_PATH, "utf-8")).toBe(sql);
  });

  it("documents why the v1 three-scenario limit is relaxed", () => {
    expect(sql).toMatch(/WHY THIS MIGRATION EXISTS/i);
    expect(sql).toMatch(/PR #4/i);
    expect(sql).toMatch(/custom scenarios/i);
    expect(sql).toMatch(/does NOT[\s\S]*edit 20250831000000_initial_schema\.sql/i);
  });

  it("explicitly drops the v1 trigger and slug constraint", () => {
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_enforce_three_scenarios ON scenarios/i,
    );
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS enforce_exactly_three_scenarios/i);
    expect(sql).toMatch(
      /ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_slug_v1/i,
    );
  });

  it("marks clinic presets without deleting seed rows", () => {
    expect(sql).toContain(
      "UPDATE scenarios SET is_preset = true WHERE slug IN ('mariana', 'rodrigo', 'efrain')",
    );
    expect(sql).not.toMatch(/DELETE FROM scenarios/i);
  });

  it("adds is_preset and config for custom scenarios", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_preset BOOLEAN");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS config JSONB");
    expect(sql).toContain("scenarios_insert_custom");
  });
});
