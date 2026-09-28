import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const FILE = "20260928120000_scenario_deactivated_at.sql";

describe("scenario deactivation migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", FILE),
    "utf-8",
  );

  it("adds deactivated_at without deleting rows", () => {
    expect(sql).toMatch(/deactivated_at/i);
    expect(sql).not.toMatch(/DELETE FROM scenarios/i);
  });
});
