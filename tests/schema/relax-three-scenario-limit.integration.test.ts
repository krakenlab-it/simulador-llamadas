import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAndMigrateAll } from "../helpers/db";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("relax three scenario limit (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await resetAndMigrateAll(client);
  });

  afterAll(async () => {
    await client?.end();
  });

  it("drops the v1 exactly-three-scenarios trigger after full migrate", async () => {
    const { rows } = await client.query<{ tgname: string }>(
      "SELECT tgname FROM pg_trigger WHERE tgname = 'trg_enforce_three_scenarios'",
    );
    expect(rows).toHaveLength(0);
  });

  it("keeps mariana, rodrigo, efrain presets intact with same slugs", async () => {
    const { rows } = await client.query<{
      slug: string;
      is_preset: boolean;
      client_name: string;
    }>(
      `SELECT slug, is_preset, client_name FROM scenarios
       WHERE slug IN ('mariana', 'rodrigo', 'efrain')
       ORDER BY sort_order`,
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.slug)).toEqual(["mariana", "rodrigo", "efrain"]);
    expect(rows.every((r) => r.is_preset)).toBe(true);
    expect(rows[0].client_name).toBe("Mariana Escobedo");
    expect(rows[1].client_name).toBe("Rodrigo Nava");
    expect(rows[2].client_name).toBe("Efraín Loera");
  });

  it("allows inserting a fourth custom scenario", async () => {
    const before = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM scenarios",
    );
    expect(Number(before.rows[0].count)).toBe(3);

    await client.query(
      `INSERT INTO scenarios (
         slug, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points, is_preset,
         industry, product_sold, config
       ) VALUES (
         'tire-shop-demo', 'Carlos', 'Dueño', 'Taller Norte', 'Media',
         'Rotación', ARRAY['inventario lento'], false,
         'llantas', 'Michelin', '{"rounds":[{"key":"apertura","label":"Apertura"}]}'::jsonb
       )`,
    );

    const after = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM scenarios",
    );
    expect(Number(after.rows[0].count)).toBe(4);

    await client.query("DELETE FROM scenarios WHERE slug = 'tire-shop-demo'");
  });

  it("exposes is_preset and industry on call_history after relax migration", async () => {
    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'call_history'
    `);
    const columns = rows.map((r) => r.column_name as string);
    expect(columns).toContain("is_preset");
    expect(columns).toContain("industry");
  });
});
