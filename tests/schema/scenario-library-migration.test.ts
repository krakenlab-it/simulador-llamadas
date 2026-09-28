import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = "20260928140000_scenario_library_published_at.sql";
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations", FILE),
  "utf8",
);

describe("scenario library migration", () => {
  it("adds library_published_at without deleting rows", () => {
    expect(sql).toMatch(/library_published_at/i);
    expect(sql).not.toMatch(/DELETE FROM scenarios/i);
  });
});
