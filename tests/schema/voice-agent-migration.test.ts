import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260902000000_scenario_voice_agent.sql",
);

describe("scenario voice_agent migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("adds a dedicated voice_agent column so replay can restore the same agent", () => {
    expect(sql).toMatch(/ALTER TABLE scenarios/i);
    expect(sql).toContain("voice_agent");
    expect(sql).toMatch(/JSONB/i);
  });

  it("does not rewrite scenario config or ConvAI tables", () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toContain("voice_convai_agents");
    expect(sql).not.toMatch(/UPDATE scenarios\s+SET config/i);
  });
});
