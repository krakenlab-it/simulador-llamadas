import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const FILE = "20250902000000_scenario_authoring.sql";
const PATH = join(process.cwd(), "supabase", "migrations", FILE);

describe("scenario authoring migration (static)", () => {
  const sql = readFileSync(PATH, "utf-8");

  it("is a new named migration, not an edit to clinic seed", () => {
    expect(sql).toMatch(/WHY THIS MIGRATION EXISTS/i);
    expect(sql).toMatch(/20250831000003_relax_three_scenario_limit/);
    expect(sql).not.toMatch(/DELETE FROM scenarios/i);
    expect(sql).not.toMatch(
      /UPDATE scenarios[\s\S]*WHERE slug IN \('mariana'|DELETE FROM scenarios WHERE slug/i,
    );
  });

  it("adds language for later voice lock without wiring TTS", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS language TEXT");
    expect(sql).toContain("CHECK (language IN ('es', 'en', 'pt'))");
    expect(sql).toMatch(/language lock/i);
  });

  it("allows updating custom scenarios and keeps presets locked", () => {
    expect(sql).toContain("CREATE POLICY scenarios_update_custom");
    expect(sql).toContain("USING (is_preset = false)");
    expect(sql).toContain("WITH CHECK (is_preset = false)");
  });
});
