import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("kraken_lab_cohorts migration", () => {
  it("defines cohort table with config jsonb and session links", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260908000000_kraken_lab_cohorts.sql",
      ),
      "utf8",
    );

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS kraken_lab_cohorts/i);
    expect(sql).toMatch(/config JSONB NOT NULL/i);
    expect(sql).toMatch(/scenario_id UUID REFERENCES scenarios/i);
    expect(sql).toMatch(/call_attempt_id UUID REFERENCES call_attempts/i);
  });
});
