import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8")).join("\n");
}

describe("schema migration (static)", () => {
  const sql = readMigrations();

  it("defines core tables", () => {
    const tables = [
      "trainees",
      "scenarios",
      "call_attempts",
      "call_turns",
      "turn_scores",
    ];
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`, "i"));
    }
  });

  it("defines call_history view", () => {
    expect(sql).toMatch(/CREATE VIEW call_history/i);
  });

  it("enforces difficulty levels 1|2|3", () => {
    expect(sql).toMatch(/difficulty_level IN \(1, 2, 3\)/);
  });

  it("enforces five rounds per call", () => {
    expect(sql).toMatch(/round_number BETWEEN 1 AND 5/);
  });

  it("defines five round types", () => {
    for (const round of [
      "apertura",
      "objecion",
      "claridad",
      "correo",
      "cierre",
    ]) {
      expect(sql).toContain(`'${round}'`);
    }
  });

  it("seeds exactly three client scenarios", () => {
    expect(sql).toContain("Mariana Escobedo");
    expect(sql).toContain("Rodrigo Nava");
    expect(sql).toContain("Efraín Loera");
    const insertCount = (sql.match(/INSERT INTO scenarios/gi) ?? []).length;
    expect(insertCount).toBe(1);
    const valueGroups = sql.match(/\),\s*\(/g) ?? [];
    expect(valueGroups.length).toBeGreaterThanOrEqual(2);
  });

  it("includes clinic content migration with short slugs", () => {
    expect(sql).toContain("scenario_fichas");
    expect(sql).toContain("scenario_reacciones");
    expect(sql).toContain("'mariana'");
    expect(sql).toContain("'rodrigo'");
    expect(sql).toContain("'efrain'");
  });

  it("limits scenario sort_order to three slots", () => {
    expect(sql).toMatch(/sort_order BETWEEN 1 AND 3/);
  });
});
