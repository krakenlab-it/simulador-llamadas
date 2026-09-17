import { describe, expect, it } from "vitest";
import {
  AGENTIC_GROUNDING_PENDING_MESSAGE,
  buildAgenticScenarioContextText,
  getAgenticGroundingPendingMessage,
  hasMinimumAgenticGrounding,
} from "@/lib/agentic/scenario-context-text";
import { mergeAgenticRuntime } from "@/lib/agentic/runtime";
import { buildAuthoredScenarioConfig } from "@/lib/scenarios/authoring";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { hasMinimumKrakenAgenticGrounding } from "@/lib/kraken-lab/context-anchors";

describe("agentic grounding requirements", () => {
  it("requires docs or product+problem before agentic is useful", () => {
    const empty = buildScenarioConfig({
      industry: "Retail",
      productSold: "",
      clientProblem: "",
      objections: [],
      winCriteria: "Reunión",
      temperament: "Neutral",
      clientName: "Ana",
    });

    expect(hasMinimumAgenticGrounding(empty)).toBe(false);
    expect(getAgenticGroundingPendingMessage(empty)).toBe(
      AGENTIC_GROUNDING_PENDING_MESSAGE,
    );

    const grounded = buildScenarioConfig({
      industry: "Retail",
      productSold: "CRM",
      clientProblem: "Leads sin seguimiento",
      objections: ["Sin presupuesto"],
      winCriteria: "Demo",
      temperament: "Neutral",
      clientName: "Ana",
    });
    expect(hasMinimumAgenticGrounding(grounded)).toBe(true);
  });

  it("preserves scenarioContextText when enabling agentic runtime", () => {
    const config = buildAuthoredScenarioConfig({
      industry: "Logística",
      productSold: "Rutas",
      clientName: "Luis",
      clientTitle: "Gerente",
      companyContext: "Operaciones Norte",
      temperament: "Directo",
      difficultyLabel: "Media",
      clientProblem: "Entregas tardías",
      objections: ["Ya tenemos TMS"],
      winCriteria: "Piloto de 2 semanas",
    });

    const merged = mergeAgenticRuntime(config, {
      enabled: true,
      sessionSeed: "seed-1",
    });

    expect(merged.agentic?.enabled).toBe(true);
    expect(merged.agentic?.scenarioContextText).toContain("Operaciones Norte");
    expect(merged.agentic?.scenarioContextText).toContain("Entregas tardías");
  });

  it("accepts kraken cohort grounding from docs or dialogue fields", () => {
    expect(
      hasMinimumKrakenAgenticGrounding({
        scenarioContext: { text: "Brief largo con contexto de ventas B2B para retail." },
        dialogueTypes: [],
        roleObjective: "",
      }),
    ).toBe(true);

    expect(
      hasMinimumKrakenAgenticGrounding({
        scenarioContext: { text: "" },
        roleObjective: "",
        dialogueTypes: [
          {
            focus: "ventas",
            productServiceExplanation: "Software de rutas",
            simulationContext: "Entregas tardías en temporada alta",
            realObjective: "",
          },
        ],
      }),
    ).toBe(true);
  });

  it("builds scenario context text from authored fields", () => {
    const text = buildAgenticScenarioContextText({
      companyContext: "Taller Norte",
      productSold: "Llantas premium",
      clientProblem: "Rotación lenta",
      industry: "Automotriz",
      winCriteria: "Visita martes 10:00",
      objections: ["Ya tengo proveedor"],
    });

    expect(text).toContain("Taller Norte");
    expect(text).toContain("Llantas premium");
    expect(text).toContain("Rotación lenta");
  });
});
