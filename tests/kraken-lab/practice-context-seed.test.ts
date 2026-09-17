import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildExampleAuthoringDraft } from "@/lib/scenarios/example-draft";
import {
  SCENARIO_BUILDER_DRAFT_STORAGE_KEY,
  saveBuilderDraftToStorage,
} from "@/lib/scenarios/builder-draft-storage";
import { upsertLocalCustomScenario } from "@/lib/scenarios/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import {
  buildPracticeBriefFromAuthoringDraft,
  MIN_SCENARIO_CONTEXT_CHARS,
  seedWizardScenarioContextFromPriorPractice,
} from "@/lib/kraken-lab/practice-context-seed";
import {
  clearWizardDraftFromStorage,
  loadWizardDraftFromStorage,
  saveWizardDraftToStorage,
} from "@/lib/kraken-lab/wizard-draft-storage";
import { fullScenarioContextText } from "@/lib/kraken-lab/scenario-context";

describe("practice context seed", () => {
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
    clearWizardDraftFromStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a brief with at least 30 characters from builder draft", () => {
    const brief = buildPracticeBriefFromAuthoringDraft(buildExampleAuthoringDraft());
    expect(brief.length).toBeGreaterThanOrEqual(MIN_SCENARIO_CONTEXT_CHARS);
    expect(brief).toContain("Valeria Soto");
    expect(brief).toContain("Kraken Flow");
  });

  it("seeds wizard context from builder draft when textarea is empty", () => {
    saveBuilderDraftToStorage({
      draftKey: "valeria-soto-importaci-n-y-distribuci-n-vk68",
      step: "success",
      draft: buildExampleAuthoringDraft(),
    });

    const seeded = seedWizardScenarioContextFromPriorPractice({
      project: "otro",
      scenarioContext: { text: "" },
    });

    expect(seeded.seeded).toBe(true);
    expect(fullScenarioContextText(seeded.draft.scenarioContext).length).toBeGreaterThanOrEqual(
      MIN_SCENARIO_CONTEXT_CHARS,
    );
    expect(fullScenarioContextText(seeded.draft.scenarioContext)).toContain("Valeria Soto");
  });

  it("seeds wizard context from local Valeria scenario", () => {
    const record: ScenarioRecord = {
      id: "scenario-valeria",
      slug: "valeria-soto-importaci-n-y-distribuci-n-vk68",
      isPreset: false,
      clientName: "Valeria Soto",
      clientTitle: "Directora de Compras",
      companyContext: "Importadora del Norte",
      difficultyLabel: "Media",
      indicator: "Mesa",
      painPoints: ["ERP"],
      industry: "Importación y distribución",
      productSold: "Kraken Flow",
      temperament: "Escéptica",
      clientProblem: "Pedidos urgentes se atascan entre ventas y almacén.",
      objections: ["Ya tenemos ERP"],
      winCriteria: "Mesa de trabajo el jueves a las 10.",
      language: "es",
      config: {
        industry: "Importación y distribución",
        productSold: "Kraken Flow",
        clientProblem: "Pedidos urgentes se atascan entre ventas y almacén.",
        objections: ["Ya tenemos ERP"],
        winCriteria: "Mesa de trabajo el jueves a las 10.",
        temperament: "Escéptica",
        language: "es",
        callType: "discovery",
        rounds: [],
        criteria: [],
        globalPositiveCriteria: [],
        openingLines: [],
        dimensionGuides: {
          valor_tailor: "Conecta Kraken Flow con las personas indicadas del colegio.",
        },
      },
    };

    upsertLocalCustomScenario(record);

    const seeded = seedWizardScenarioContextFromPriorPractice({
      project: "otro",
      scenarioContext: { text: "" },
    });

    expect(seeded.seeded).toBe(true);
    expect(fullScenarioContextText(seeded.draft.scenarioContext)).toContain("Valeria Soto");
    expect(fullScenarioContextText(seeded.draft.scenarioContext).length).toBeGreaterThanOrEqual(
      MIN_SCENARIO_CONTEXT_CHARS,
    );
  });
});

describe("wizard draft save guard", () => {
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
    clearWizardDraftFromStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not wipe stored scenarioContext when saving an empty incoming draft", () => {
    saveWizardDraftToStorage({
      step: "proyecto",
      mode: "texto",
      draft: {
        project: "otro",
        scenarioContext: {
          text: "Vendemos Kraken Flow a importadoras con objeciones de ERP y captura duplicada.",
        },
      },
    });

    saveWizardDraftToStorage({
      step: "proyecto",
      mode: "texto",
      draft: {
        project: "otro",
        scenarioContext: { text: "" },
      },
    });

    const loaded = loadWizardDraftFromStorage();
    expect(fullScenarioContextText(loaded?.draft.scenarioContext)).toContain("Kraken Flow");
  });

  it("seeds context through the restore helper used by the wizard button", () => {
    saveBuilderDraftToStorage({
      draftKey: "new",
      step: "success",
      draft: buildExampleAuthoringDraft(),
    });

    const before = seedWizardScenarioContextFromPriorPractice({
      project: "otro",
      scenarioContext: { text: "" },
    });
    expect(before.seeded).toBe(true);
    expect(store[SCENARIO_BUILDER_DRAFT_STORAGE_KEY]).toBeTruthy();
  });
});
