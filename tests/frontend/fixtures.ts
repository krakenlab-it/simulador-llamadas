import type { ScenarioRecord } from "@/lib/scenarios/types";

/** Minimal preset scenario fixture for frontend tests. */
export const marianaScenarioFixture: ScenarioRecord = {
  id: "preset-mariana",
  slug: "mariana",
  clientName: "Mariana Escobedo",
  clientTitle: "Directora de Operaciones",
  companyContext: "Clínica de Citas",
  difficultyLabel: "Media",
  indicator: "Visitas a caseta",
  painPoints: ["Medición", "ROI", "KPI"],
  industry: null,
  productSold: null,
  temperament: null,
  clientProblem: null,
  objections: [],
  winCriteria: null,
  isPreset: true,
  config: {
    industry: "clinica",
    productSold: "software",
    clientProblem: "medición",
    objections: [],
    winCriteria: "cita",
    temperament: "escéptica",
    rounds: [],
    criteria: [],
    globalPositiveCriteria: [],
    openingLines: ["Hola"],
  },
};
