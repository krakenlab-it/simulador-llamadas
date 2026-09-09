import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  stubCreateScenario,
  stubCreateSession,
  stubEndSession,
  stubListScenarios,
  stubSubmitTurn,
  stubUpdateScenario,
  resetStubSessions,
} from "@/lib/api/stubs";
import {
  clearLocalCustomScenarios,
  loadLocalCustomScenarios,
  upsertLocalCustomScenario,
} from "@/lib/scenarios/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";

describe("custom scenario stubs", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
    resetStubSessions();
    clearLocalCustomScenarios();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLocalCustomScenarios();
    resetStubSessions();
  });

  it("creates and runs a custom scenario session with rich evaluation", async () => {
    const scenario = stubCreateScenario({
      industry: "gimnasio",
      productSold: "membresía anual",
      clientName: "Laura Méndez",
      clientTitle: "Gerente",
      companyContext: "Cadena de gimnasios",
      temperament: "Impaciente",
      difficultyLabel: "Media",
      clientProblem: "baja retención de socios",
      objections: ["Muy caro"],
      winCriteria: "SPIN Advance: visita con acción concreta",
    });

    const session = stubCreateSession({
      scenarioSlug: scenario.slug,
      mode: "texto",
      difficultyLevel: 2,
    });

    expect(session.isPreset).toBe(false);
    expect(session.totalRounds).toBe(5);

    const turn = await stubSubmitTurn(session.callAttemptId, {
      utterance:
        "Entiendo la retención en su gimnasio. ¿Qué ha probado y qué resultado vio?",
    });

    expect(turn.richFeedback.whyScore).toBeTruthy();
    expect(turn.richFeedback.analytics).toBeDefined();

    const ended = await stubEndSession(session.callAttemptId);
    expect(ended.evaluation).toBeDefined();
    expect(ended.evaluation.nextDrill).toBeTruthy();
    expect(ended.evaluation.scorecard).toBeDefined();
    expect(ended.totalRounds).toBe(5);
  });

  it("updates success criteria on a custom scenario and keeps the slug", () => {
    const created = stubCreateScenario({
      industry: "banco",
      productSold: "cuenta pyme",
      clientName: "Ana Soto",
      clientTitle: "Gerente",
      companyContext: "Banco Sur",
      temperament: "Directa",
      difficultyLabel: "Media",
      clientProblem: "filas largas",
      objections: ["Ya tenemos core"],
      winCriteria: "Cita en sucursal",
      language: "es",
      callType: "discovery",
    });

    const updated = stubUpdateScenario({
      slug: created.slug,
      industry: created.industry ?? "banco",
      productSold: created.productSold ?? "cuenta pyme",
      clientName: created.clientName,
      clientTitle: created.clientTitle,
      companyContext: created.companyContext,
      temperament: created.temperament ?? "Directa",
      difficultyLabel: created.difficultyLabel,
      clientProblem: created.clientProblem ?? "filas largas",
      objections: created.objections,
      winCriteria: "SPIN Advance: mesa de trabajo el viernes a las 11",
      language: "es",
      callType: "cierre",
      dimensionGuides: {
        cierre_siguiente_paso: "Agenda mesa de trabajo con hora.",
      },
    });

    expect(updated.slug).toBe(created.slug);
    expect(updated.winCriteria).toBe(
      "SPIN Advance: mesa de trabajo el viernes a las 11",
    );
    expect(updated.config.callType).toBe("cierre");
    expect(updated.config.dimensionGuides?.cierre_siguiente_paso).toContain(
      "mesa de trabajo",
    );
    expect(stubListScenarios().some((s) => s.slug === created.slug)).toBe(true);
  });

  it("updates a scenario hydrated from localStorage after stub reset", () => {
    const created = stubCreateScenario({
      industry: "importacion",
      productSold: "Kraken Flow",
      clientName: "Valeria Soto",
      clientTitle: "Directora de Compras",
      companyContext: "Importadora del Norte",
      temperament: "Escéptica",
      difficultyLabel: "Media",
      clientProblem: "pedidos urgentes atascados",
      objections: ["Ya tenemos ERP"],
      winCriteria: "Mesa de trabajo el jueves",
      language: "es",
      callType: "discovery",
    });

    resetStubSessions();
    expect(loadLocalCustomScenarios().some((scenario) => scenario.slug === created.slug)).toBe(
      true,
    );

    const updated = stubUpdateScenario({
      slug: created.slug,
      industry: "importacion",
      productSold: "Kraken Flow",
      clientName: "Valeria Soto",
      clientTitle: "Directora de Compras",
      companyContext: "Importadora del Norte",
      temperament: "Escéptica",
      difficultyLabel: "Media",
      clientProblem: "pedidos urgentes atascados",
      objections: ["Ya tenemos ERP"],
      winCriteria: "SPIN Advance: mesa jueves 10:00",
      language: "es",
      callType: "discovery",
      dimensionGuides: {
        valor_tailor:
          "Conecta Kraken Flow con la posibilidad de llegar a las personas indicadas que quiere el colegio",
      },
    });

    expect(updated.slug).toBe(created.slug);
    expect(updated.config.dimensionGuides?.valor_tailor).toContain("Kraken Flow");
  });

  it("upserts update payload when slug exists only in localStorage", () => {
    const slug = "valeria-soto-importaci-n-y-distribuci-n-vk68";
    const record: ScenarioRecord = {
      id: "scenario-valeria",
      slug,
      isPreset: false,
      clientName: "Valeria Soto",
      clientTitle: "Directora de Compras",
      companyContext: "Importadora del Norte",
      difficultyLabel: "Media",
      indicator: "Mesa",
      painPoints: ["ERP"],
      industry: "importacion",
      productSold: "Kraken Flow",
      temperament: "Escéptica",
      clientProblem: "pedidos urgentes atascados",
      objections: ["Ya tenemos ERP"],
      winCriteria: "Mesa de trabajo",
      language: "es",
      config: {
        industry: "importacion",
        productSold: "Kraken Flow",
        clientProblem: "pedidos urgentes atascados",
        objections: ["Ya tenemos ERP"],
        winCriteria: "Mesa de trabajo",
        temperament: "Escéptica",
        language: "es",
        callType: "discovery",
        rounds: [],
        criteria: [],
        globalPositiveCriteria: [],
        openingLines: [],
      },
    };

    upsertLocalCustomScenario(record);
    resetStubSessions();

    const updated = stubUpdateScenario({
      slug,
      industry: "importacion",
      productSold: "Kraken Flow",
      clientName: "Valeria Soto",
      clientTitle: "Directora de Compras",
      companyContext: "Importadora del Norte",
      temperament: "Escéptica",
      difficultyLabel: "Media",
      clientProblem: "pedidos urgentes atascados",
      objections: ["Ya tenemos ERP"],
      winCriteria: "SPIN Advance: mesa jueves 10:00",
      language: "es",
      callType: "discovery",
      dimensionGuides: {
        compostura_objecion:
          "Valida el ERP actual y propone pruebas de concepto y prueba de que funciona Kraken Flow",
      },
    });

    expect(updated.slug).toBe(slug);
    expect(updated.config.dimensionGuides?.compostura_objecion).toContain("ERP");
  });
});
