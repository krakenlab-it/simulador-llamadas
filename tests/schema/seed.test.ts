import { describe, expect, it } from "vitest";
import {
  loadClinicV1MigrationSql,
  loadMigrationSql,
} from "@/tests/helpers/db";

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

  it("tightens scenario slugs to mariana, rodrigo, efrain", () => {
    expect(sql).toContain("slug IN ('mariana', 'rodrigo', 'efrain')");
    expect(sql).toContain("SET slug = 'mariana'");
    expect(sql).toContain("SET slug = 'rodrigo'");
    expect(sql).toContain("SET slug = 'efrain'");
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
    expect(sql).toContain("Ya tenemos agencia y local. No busco otra cosa.");
  });

  it("keeps clinic-v1 seed on caseta and applies local only in later migrations", () => {
    const clinicV1 = loadClinicV1MigrationSql();
    expect(clinicV1).toContain("Ya tenemos agencia y caseta. No busco otra cosa.");
    expect(clinicV1).not.toContain("Ya tenemos agencia y local. No busco otra cosa.");
    expect(sql).toContain(
      "SET saludo = 'Ya tenemos agencia y local. No busco otra cosa.'",
    );
  });
});
