import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";
import {
  KRAKEN_WIZARD_DRAFT_STORAGE_KEY,
  clearWizardDraftFromStorage,
  hydrateWizardDraft,
  loadWizardDraftFromStorage,
  mergeWizardDraftWithDefaults,
  saveWizardDraftToStorage,
  serializeWizardDraft,
  wizardDraftHasSavedContent,
} from "@/lib/kraken-lab/wizard-draft-storage";

const SAMPLE_DRAFT: Partial<KrakenLabCohortConfig> = {
  project: "simulador-llamadas",
  scenarioContext: {
    text: "Software de inventarios para directoras de compras.",
    uploadedAt: "2026-09-09T12:00:00.000Z",
    files: [
      {
        id: "brief-1",
        name: "brief.txt",
        text: "Objeción: ya tenemos ERP. Producto: Kraken Flow.",
      },
    ],
  },
  participantCount: 1,
  participants: [
    {
      fullName: "Santiago Mendoza",
      age: 28,
      city: "Ciudad de México",
      simulationCities: ["Monterrey"],
      phone: "+52 55 1234 5678",
      email: "santiago@example.com",
      cvFileName: "santiago.txt",
    },
  ],
  simulationFocuses: ["ventas"],
  simulatorRole: "caller",
  roleObjective: "Agendar demo",
  sessionSeed: "seed-test-123",
};

describe("wizard draft storage", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      store,
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

  it("round-trips scenarioContext and participants through serialize and hydrate", () => {
    const serialized = serializeWizardDraft({
      step: "perfiles",
      mode: "texto",
      draft: SAMPLE_DRAFT,
    });

    const hydrated = hydrateWizardDraft(serialized);
    expect(hydrated).not.toBeNull();
    expect(hydrated?.draft.scenarioContext?.text).toBe(SAMPLE_DRAFT.scenarioContext?.text);
    expect(hydrated?.draft.scenarioContext?.files?.[0]?.name).toBe("brief.txt");
    expect(hydrated?.draft.scenarioContext?.files?.[0]?.text).toContain("Objeción");
    expect(hydrated?.draft.participants?.[0]?.fullName).toBe("Santiago Mendoza");
    expect(hydrated?.draft.participants?.[0]?.cvFileName).toBe("santiago.txt");
    expect(hydrated?.step).toBe("perfiles");
  });

  it("persists to localStorage and reloads on mount helpers", () => {
    saveWizardDraftToStorage({
      step: "proyecto",
      mode: "voz",
      draft: SAMPLE_DRAFT,
    });

    const loaded = loadWizardDraftFromStorage();
    expect(loaded?.mode).toBe("voz");
    expect(loaded?.draft.participants?.[0]?.email).toBe("santiago@example.com");
    expect(localStorage.getItem(KRAKEN_WIZARD_DRAFT_STORAGE_KEY)).toContain(
      "Software de inventarios",
    );
  });

  it("merges stored draft with defaults for missing fields", () => {
    const merged = mergeWizardDraftWithDefaults({
      scenarioContext: SAMPLE_DRAFT.scenarioContext,
      participants: SAMPLE_DRAFT.participants,
    });

    expect(merged.project).toBe("simulador-llamadas");
    expect(merged.participantCount).toBe(1);
    expect(merged.dialogueTypes?.length).toBeGreaterThan(0);
  });

  it("clears stored draft", () => {
    saveWizardDraftToStorage({
      step: "proyecto",
      mode: "texto",
      draft: SAMPLE_DRAFT,
    });
    clearWizardDraftFromStorage();
    expect(loadWizardDraftFromStorage()).toBeNull();
  });

  it("detects when a draft contains practice documentation", () => {
    expect(wizardDraftHasSavedContent(SAMPLE_DRAFT)).toBe(true);
    expect(wizardDraftHasSavedContent({ project: "simulador-llamadas" })).toBe(false);
  });

  it("does not overwrite stored scenarioContext when saving an empty incoming draft", () => {
    saveWizardDraftToStorage({
      step: "proyecto",
      mode: "texto",
      draft: SAMPLE_DRAFT,
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
    expect(loaded?.draft.scenarioContext?.text).toContain("Software de inventarios");
  });
});
