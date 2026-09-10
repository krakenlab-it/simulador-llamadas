import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalCustomScenarios,
  loadLocalCustomScenarios,
  upsertLocalCustomScenario,
} from "@/lib/scenarios/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import { stubCreateScenario, stubListScenarios, resetStubSessions } from "@/lib/api/stubs";

describe("local custom scenarios", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLocalCustomScenarios();
    resetStubSessions();
  });

  it("persists custom scenarios across stub resets", () => {
    const created = stubCreateScenario({
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

    resetStubSessions();

    expect(loadLocalCustomScenarios().some((s) => s.slug === created.slug)).toBe(
      true,
    );
    expect(stubListScenarios().some((s) => s.slug === created.slug)).toBe(true);
  });

  it("upserts by slug without duplicating entries", () => {
    const first: ScenarioRecord = {
      id: "scenario-1",
      slug: "laura-gimnasio",
      isPreset: false,
      clientName: "Laura Méndez",
      clientTitle: "Gerente",
      companyContext: "Cadena",
      difficultyLabel: "Media",
      indicator: "Visita",
      painPoints: ["baja retención"],
      industry: "gimnasio",
      productSold: "membresía",
      temperament: "Impaciente",
      clientProblem: "baja retención",
      objections: ["Muy caro"],
      winCriteria: "Visita",
      language: "es",
      config: {
        industry: "gimnasio",
        productSold: "membresía",
        clientProblem: "baja retención",
        objections: ["Muy caro"],
        winCriteria: "Visita",
        temperament: "Impaciente",
        rounds: [],
        criteria: [],
        globalPositiveCriteria: [],
        openingLines: [],
      },
    };

    upsertLocalCustomScenario(first);
    upsertLocalCustomScenario({
      ...first,
      winCriteria: "SPIN Advance: visita el martes",
      config: {
        ...first.config,
        winCriteria: "SPIN Advance: visita el martes",
      },
    });

    const stored = loadLocalCustomScenarios();
    expect(stored).toHaveLength(1);
    expect(stored[0].winCriteria).toBe("SPIN Advance: visita el martes");
  });
});
