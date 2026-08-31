import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const databaseUrl = process.env.DATABASE_URL;

function loadMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
    .join("\n");
}

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("schema migration (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(loadMigrationSql());
  });

  afterAll(async () => {
    await client?.end();
  });

  it("creates expected tables", async () => {
    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "trainees",
        "scenarios",
        "call_attempts",
        "call_turns",
        "turn_scores",
      ]),
    );
  });

  it("seeds exactly three scenarios", async () => {
    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM scenarios",
    );
    expect(Number(rows[0].count)).toBe(3);
  });

  it("seeds clinic content tables", async () => {
    const { rows } = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'scenario_cierres',
          'scenario_claves',
          'scenario_fichas',
          'scenario_frases',
          'scenario_problemas',
          'scenario_reacciones',
          'scenario_round_prompts',
          'scenario_saludos'
        )
      ORDER BY table_name
    `);
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual([
      "scenario_cierres",
      "scenario_claves",
      "scenario_fichas",
      "scenario_frases",
      "scenario_problemas",
      "scenario_reacciones",
      "scenario_round_prompts",
      "scenario_saludos",
    ]);
  });

  it("uses short scenario slugs after migration", async () => {
    const { rows } = await client.query<{ slug: string }>(
      "SELECT slug FROM scenarios ORDER BY sort_order",
    );
    expect(rows.map((r) => r.slug)).toEqual(["mariana", "rodrigo", "efrain"]);
  });

  it("rejects invalid difficulty level on insert", async () => {
    const trainee = await client.query<{ id: string }>(
      "INSERT INTO trainees (display_name) VALUES ('Test Trainee') RETURNING id",
    );
    const scenario = await client.query<{ id: string }>(
      "SELECT id FROM scenarios ORDER BY sort_order LIMIT 1",
    );

    await expect(
      client.query(
        `INSERT INTO call_attempts (trainee_id, scenario_id, difficulty_level, mode)
         VALUES ($1, $2, 4, 'texto')`,
        [trainee.rows[0].id, scenario.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("exposes call_history view with seeded data shape", async () => {
    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'call_history'
    `);
    const columns = rows.map((r) => r.column_name as string);
    expect(columns).toEqual(
      expect.arrayContaining([
        "call_attempt_id",
        "trainee_id",
        "scenario_slug",
        "client_name",
        "difficulty_level",
        "won",
        "total_score",
        "round_scores",
      ]),
    );
  });

  it("seeds ficha, problemas, claves, saludos, reacciones, cierres, frases per scenario", async () => {
    const { rows: scenarios } = await client.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM scenarios ORDER BY sort_order",
    );

    for (const scenario of scenarios) {
      const counts = await client.query<{
        fichas: string;
        problemas: string;
        claves: string;
        saludos: string;
        reacciones: string;
        cierres: string;
        frases: string;
        prompts: string;
      }>(
        `
        SELECT
          (SELECT COUNT(*)::text FROM scenario_fichas WHERE scenario_id = $1) AS fichas,
          (SELECT COUNT(*)::text FROM scenario_problemas WHERE scenario_id = $1) AS problemas,
          (SELECT COUNT(*)::text FROM scenario_claves WHERE scenario_id = $1) AS claves,
          (SELECT COUNT(*)::text FROM scenario_saludos WHERE scenario_id = $1) AS saludos,
          (SELECT COUNT(*)::text FROM scenario_reacciones WHERE scenario_id = $1) AS reacciones,
          (SELECT COUNT(*)::text FROM scenario_cierres WHERE scenario_id = $1) AS cierres,
          (SELECT COUNT(*)::text FROM scenario_frases WHERE scenario_id = $1) AS frases,
          (SELECT COUNT(*)::text FROM scenario_round_prompts WHERE scenario_id = $1) AS prompts
        `,
        [scenario.id],
      );
      const c = counts.rows[0];
      expect(Number(c.fichas), `${scenario.slug} ficha`).toBe(1);
      expect(Number(c.problemas), `${scenario.slug} problemas`).toBeGreaterThanOrEqual(1);
      expect(Number(c.claves), `${scenario.slug} claves`).toBeGreaterThanOrEqual(3);
      expect(Number(c.saludos), `${scenario.slug} saludos`).toBeGreaterThanOrEqual(2);
      expect(Number(c.reacciones), `${scenario.slug} reacciones`).toBe(12);
      expect(Number(c.cierres), `${scenario.slug} cierres`).toBeGreaterThanOrEqual(1);
      expect(Number(c.frases), `${scenario.slug} frases`).toBe(5);
      expect(Number(c.prompts), `${scenario.slug} prompts`).toBe(5);
    }
  });

  it("covers bien, medio, mal reacciones for apertura through correo", async () => {
    const { rows } = await client.query<{ round_type: string; quality: string }>(
      `
      SELECT DISTINCT round_type, quality
      FROM scenario_reacciones
      ORDER BY round_type, quality
      `,
    );
    const expectedRounds = ["apertura", "claridad", "correo", "objecion"];
    const expectedQualities = ["bien", "mal", "medio"];

    for (const round of expectedRounds) {
      for (const quality of expectedQualities) {
        expect(rows).toContainEqual({ round_type: round, quality });
      }
    }
    expect(rows).toHaveLength(12);
  });

  it("ports mariana saludo from prototype", async () => {
    const { rows } = await client.query<{ saludo: string }>(
      `
      SELECT saludo FROM scenario_saludos
      WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
        AND difficulty_level IS NULL
      ORDER BY sort_order
      `,
    );
    expect(rows[0].saludo).toBe("¿Quién habla? Estoy entre juntas.");
    expect(rows[1].saludo).toBe("Ya tenemos agencia y caseta. No busco otra cosa.");
  });

  it("enforces exactly-three-scenarios trigger exists", async () => {
    const { rows } = await client.query<{ tgname: string }>(
      "SELECT tgname FROM pg_trigger WHERE tgname = 'trg_enforce_three_scenarios'",
    );
    expect(rows).toHaveLength(1);
  });

  it("call_history includes round_scores JSON", async () => {
    const trainee = await client.query<{ id: string }>(
      "INSERT INTO trainees (display_name) VALUES ('Seed Test') RETURNING id",
    );
    const scenario = await client.query<{ id: string }>(
      "SELECT id FROM scenarios WHERE slug = 'efrain'",
    );

    const attempt = await client.query<{ id: string }>(
      `INSERT INTO call_attempts (trainee_id, scenario_id, difficulty_level, mode, status, won, total_score)
       VALUES ($1, $2, 2, 'texto', 'completed', false, 55.00)
       RETURNING id`,
      [trainee.rows[0].id, scenario.rows[0].id],
    );

    const turn = await client.query<{ id: string }>(
      `INSERT INTO call_turns (call_attempt_id, round_number, round_type, trainee_utterance)
       VALUES ($1, 1, 'apertura', 'Entiendo el piso flojo')
       RETURNING id`,
      [attempt.rows[0].id],
    );

    await client.query(
      `INSERT INTO turn_scores (turn_id, keyword_hits, round_score, has_concrete_day_and_time)
       VALUES ($1, '{"problema": true}', 70.00, false)`,
      [turn.rows[0].id],
    );

    const { rows } = await client.query<{ round_scores: unknown }>(
      "SELECT round_scores FROM call_history WHERE call_attempt_id = $1",
      [attempt.rows[0].id],
    );

    expect(Array.isArray(rows[0].round_scores)).toBe(true);
    const scores = rows[0].round_scores as Array<{ round_type: string; round_score: number }>;
    expect(scores[0].round_type).toBe("apertura");
    expect(Number(scores[0].round_score)).toBe(70);
  });

  it("adds client_reaction to turn_scores", async () => {
    const { rows } = await client.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'turn_scores'
        AND column_name = 'client_reaction'
    `);
    expect(rows).toHaveLength(1);
  });
});
