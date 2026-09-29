import { describe, expect, it, beforeEach } from "vitest";
import {
  resetStubSessions,
  stubCreateScenario,
  stubCreateSession,
  stubSetScenarioActive,
  stubSetScenarioLibraryPublished,
} from "@/lib/api/stubs";
import {
  isScenarioActiveForPractice,
  isScenarioPublishedToLibrary,
} from "@/lib/scenarios/types";
import { customGymScenarioFixture } from "@/tests/frontend/fixtures";

describe("scenario lifecycle (soft deactivate)", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("marks custom scenarios inactive without removing them", () => {
    const created = stubCreateScenario({
      industry: customGymScenarioFixture.industry ?? "Retail",
      productSold: customGymScenarioFixture.productSold ?? "Producto",
      clientName: "Pedro Perez",
      clientTitle: "Gerente",
      companyContext: "Hotel",
      temperament: "Prepotente",
      difficultyLabel: "Intermedio",
      clientProblem: "Problema",
      objections: [],
      winCriteria: "Cita",
    });
    expect(isScenarioActiveForPractice(created)).toBe(true);

    const retired = stubSetScenarioActive(created.slug, false);
    expect(retired.deactivatedAt).toBeTruthy();
    expect(isScenarioActiveForPractice(retired)).toBe(false);

    const again = stubSetScenarioActive(created.slug, true);
    expect(again.deactivatedAt).toBeFalsy();
  });

  it("publishes custom scenarios to the library catalog", () => {
    const created = stubCreateScenario({
      industry: "Retail",
      productSold: "POS",
      clientName: "Lucía Paz",
      clientTitle: "Dueña",
      companyContext: "Tienda",
      temperament: "Directa",
      difficultyLabel: "Media",
      clientProblem: "inventario",
      objections: [],
      winCriteria: "Demo",
    });
    expect(isScenarioPublishedToLibrary(created)).toBe(false);
    const published = stubSetScenarioLibraryPublished(created.slug, true);
    expect(isScenarioPublishedToLibrary(published)).toBe(true);
    const unpublished = stubSetScenarioLibraryPublished(created.slug, false);
    expect(isScenarioPublishedToLibrary(unpublished)).toBe(false);
  });

  it("blocks starting a session on a deactivated scenario", () => {
    const created = stubCreateScenario({
      industry: "Turismo",
      productSold: "Hotel",
      clientName: "Andrés Villacís",
      clientTitle: "Gerente",
      companyContext: "Mudanzas",
      temperament: "Escéptico",
      difficultyLabel: "Difícil",
      clientProblem: "Problema",
      objections: [],
      winCriteria: "Cita",
    });
    stubSetScenarioActive(created.slug, false);
    expect(() =>
      stubCreateSession({
        scenarioSlug: created.slug,
        mode: "texto",
        difficultyLevel: 2,
      }),
    ).toThrow(/baja/i);
  });
});
