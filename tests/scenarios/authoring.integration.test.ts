import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAndMigrateAll } from "../helpers/db";
import { draftToCreateInput, emptyAuthoringDraft } from "@/lib/scenarios/authoring";
import {
  PresetScenarioLockedError,
  ScenarioRepository,
} from "@/lib/scenarios/repository";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("scenario authoring (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await resetAndMigrateAll(client);
  });

  afterAll(async () => {
    await client?.end();
  });

  it("creates and edits a custom scenario including success criteria", async () => {
    const repo = new ScenarioRepository(client);
    const draft = emptyAuthoringDraft("es");
    const created = await repo.createCustom(
      draftToCreateInput({
        ...draft,
        industry: "gimnasio boutique",
        productSold: "membresía anual",
        clientName: "Laura Méndez",
        clientTitle: "Gerente",
        companyContext: "Cadena de gimnasios",
        clientProblem: "baja retención de socios",
        objections: ["Muy caro"],
        winCriteria: "Visita de diagnóstico el jueves a las 9",
        callType: "discovery",
      }),
    );

    expect(created.isPreset).toBe(false);
    expect(created.language).toBe("es");
    expect(created.winCriteria).toBe("Visita de diagnóstico el jueves a las 9");
    expect(created.config.rounds).toHaveLength(5);
    expect(created.config.callType).toBe("discovery");
    expect(created.config.dimensionGuides?.apertura_contrato).toBeTruthy();

    const updated = await repo.updateCustom({
      slug: created.slug,
      industry: created.industry ?? "gimnasio boutique",
      productSold: created.productSold ?? "membresía anual",
      clientName: created.clientName,
      clientTitle: created.clientTitle,
      companyContext: created.companyContext,
      temperament: created.temperament ?? draft.temperament,
      difficultyLabel: created.difficultyLabel,
      clientProblem: created.clientProblem ?? "baja retención de socios",
      objections: ["Ya renovamos con otro"],
      winCriteria: "SPIN Advance: clase prueba el viernes a las 18",
      language: "es",
      callType: "cierre",
      rounds: created.config.rounds.map((round, index) =>
        index === 4
          ? { ...round, whatGoodLooksLike: "Cierra con día y hora en el gym." }
          : round,
      ),
      dimensionGuides: {
        ...created.config.dimensionGuides,
        cierre_siguiente_paso: "Clase prueba con horario concreto.",
      },
    });

    expect(updated.slug).toBe(created.slug);
    expect(updated.winCriteria).toBe(
      "SPIN Advance: clase prueba el viernes a las 18",
    );
    expect(updated.config.callType).toBe("cierre");
    expect(updated.config.rounds[4]?.whatGoodLooksLike).toContain("día y hora");
    expect(updated.config.dimensionGuides?.cierre_siguiente_paso).toContain(
      "Clase prueba",
    );
    expect(updated.objections).toEqual(["Ya renovamos con otro"]);

    const reloaded = await repo.getBySlug(created.slug);
    expect(reloaded?.winCriteria).toBe(updated.winCriteria);
    expect(reloaded?.config.dimensionGuides?.cierre_siguiente_paso).toContain(
      "Clase prueba",
    );
  });

  it("refuses to edit clinic presets", async () => {
    const repo = new ScenarioRepository(client);
    const mariana = await repo.getBySlug("mariana");
    expect(mariana?.isPreset).toBe(true);

    await expect(
      repo.updateCustom({
        slug: "mariana",
        industry: "clinica",
        productSold: "software",
        clientName: "Mariana Escobedo",
        clientTitle: "Directora",
        companyContext: "Clínica",
        temperament: "Difícil",
        difficultyLabel: "Difícil",
        clientProblem: "visitas",
        objections: [],
        winCriteria: "no-edit",
      }),
    ).rejects.toBeInstanceOf(PresetScenarioLockedError);
  });

  it("adds the language column and leaves presets on Spanish", async () => {
    const { rows } = await client.query<{ slug: string; language: string }>(
      `SELECT slug, language FROM scenarios
       WHERE slug IN ('mariana', 'rodrigo', 'efrain')
       ORDER BY slug`,
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.language === "es")).toBe(true);
  });
});
