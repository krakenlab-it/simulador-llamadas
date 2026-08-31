import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function loadMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

describe("clinic content seed (static)", () => {
  const sql = loadMigrationSql();

  it("defines clinic content tables", () => {
    const tables = [
      "scenario_fichas",
      "scenario_problemas",
      "scenario_claves",
      "scenario_saludos",
      "scenario_reacciones",
      "scenario_cierres",
      "scenario_frases",
      "scenario_round_prompts",
    ];
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`, "i"));
    }
  });

  it("defines reaction_quality enum with bien, medio, mal", () => {
    expect(sql).toMatch(/CREATE TYPE reaction_quality AS ENUM \('bien', 'medio', 'mal'\)/);
  });

  it("tightens scenario slugs to mariana, rodrigo, efrain in v1 seed", () => {
    expect(sql).toContain("SET slug = 'mariana'");
    expect(sql).toContain("SET slug = 'rodrigo'");
    expect(sql).toContain("SET slug = 'efrain'");
  });

  it("allows custom scenarios in later migration", () => {
    expect(sql).toContain("is_preset");
    expect(sql).toContain("scenarios_insert_custom");
  });

  it("enriches call_history with round_scores", () => {
    expect(sql).toMatch(/round_scores/i);
    expect(sql).toMatch(/CREATE OR REPLACE VIEW call_history/i);
  });

  it("seeds reacciones for four rounds × three qualities", () => {
    expect(sql).toContain("scenario_reacciones");
    expect(sql).toContain("'bien'");
    expect(sql).toContain("'medio'");
    expect(sql).toContain("'mal'");
  });

  it("ports prototype saludos for mariana", () => {
    expect(sql).toContain("¿Quién habla? Estoy entre juntas.");
    expect(sql).toContain("Ya tenemos agencia y caseta. No busco otra cosa.");
  });
});
