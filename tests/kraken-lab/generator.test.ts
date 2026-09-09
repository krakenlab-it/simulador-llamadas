import { describe, expect, it } from "vitest";
import {
  buildDialogueBattery,
  buildKrakenScenario,
  createDefaultSessionSeed,
  generateReceiverPersonas,
  mintFreshSessionSeed,
} from "@/lib/kraken-lab/generator";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";
import {
  canAdvanceWizardStep,
  defaultCohortDraft,
  validateFullCohort,
} from "@/lib/kraken-lab/validation";

const SAMPLE_CONTEXT =
  "Vendemos software de inventarios a directoras de compras. Objeciones: ya tenemos proveedor y no hay presupuesto.";

function sampleCohort(overrides: Partial<KrakenLabCohortConfig> = {}): KrakenLabCohortConfig {
  const seed = overrides.sessionSeed ?? "test-seed-123";
  const base: KrakenLabCohortConfig = {
    project: "simulador-llamadas",
    scenarioContext: { text: SAMPLE_CONTEXT },
    participantCount: 1,
    participants: [
      {
        fullName: "Ana Pasante",
        age: 22,
        city: "Guadalajara",
        simulationCities: ["Monterrey", "CDMX"],
        phone: "3312345678",
        email: "ana@example.com",
      },
    ],
    simulationFocuses: ["ventas"],
    simulatorRole: "caller",
    roleObjective: "Agendar reunión con día y hora",
    dialogueTypes: [
      {
        focus: "ventas",
        simulationContext: "Llamada fría a director de compras",
        realObjective: "Conseguir demo de 15 minutos",
        productServiceExplanation: "Software de inventarios",
      },
    ],
    receiverPersonas: [],
    selectedPersonaId: undefined,
    difficultyLevel: 2,
    sessionSeed: seed,
    ...overrides,
  };
  base.receiverPersonas = generateReceiverPersonas(base, 3);
  base.selectedPersonaId = base.receiverPersonas[0]?.id;
  return base;
}

describe("Kraken Lab generator", () => {
  it("generates deterministic personas for the same seed", () => {
    const cohort = sampleCohort();
    const a = generateReceiverPersonas(cohort, 3);
    const b = generateReceiverPersonas(cohort, 3);
    expect(a.map((persona) => persona.name)).toEqual(b.map((persona) => persona.name));
    expect(a[0].attentionStates).toEqual(b[0].attentionStates);
  });

  it("changes personas when the session seed is refreshed", () => {
    const first = generateReceiverPersonas(sampleCohort({ sessionSeed: mintFreshSessionSeed() }), 3);
    const second = generateReceiverPersonas(sampleCohort({ sessionSeed: mintFreshSessionSeed() }), 3);
    expect(first.map((persona) => persona.name).join("|")).not.toBe(
      second.map((persona) => persona.name).join("|"),
    );
  });

  it("changes personas when difficulty changes", () => {
    const easy = sampleCohort({ difficultyLevel: 1, sessionSeed: "diff-test-easy" });
    const hard = sampleCohort({ difficultyLevel: 3, sessionSeed: "diff-test-hard" });
    const easyPersona = generateReceiverPersonas(easy, 3)[0];
    const hardPersona = generateReceiverPersonas(hard, 3)[0];
    expect(easyPersona.extras.patienceLevel).not.toBe(hardPersona.extras.patienceLevel);
  });

  it("builds a five-round dialogue battery with attention states", () => {
    const cohort = sampleCohort();
    const persona = cohort.receiverPersonas[0];
    const rounds = buildDialogueBattery(cohort, persona);
    expect(rounds).toHaveLength(5);
    expect(rounds[0].clientPrompt.length).toBeGreaterThan(10);
    expect(rounds[4].goal.toLowerCase()).toMatch(/día|hora|paso|reunión|cierre/);
  });

  it("adapts win criteria for ventas vs seguimiento", () => {
    const ventas = buildKrakenScenario(sampleCohort()).config.winCriteria;
    const seguimiento = buildKrakenScenario(
      sampleCohort({
        roleObjective: "",
        simulationFocuses: ["seguimiento"],
        dialogueTypes: [
          {
            focus: "seguimiento",
            simulationContext: "Seguimiento de propuesta enviada",
            realObjective: "Confirmar revisión y próxima fecha",
            productServiceExplanation: "Propuesta logística",
          },
        ],
      }),
    ).config.winCriteria;
    expect(ventas.toLowerCase()).toMatch(/día|hora/);
    expect(seguimiento.toLowerCase()).toMatch(/seguimiento|fecha/);
  });

  it("creates stable session seeds from cohort inputs", () => {
    const seed = createDefaultSessionSeed({
      project: "kraken-flow",
      participantCount: 2,
      participants: [{ ...defaultCohortDraft().participants![0], email: "x@test.com" }],
    });
    expect(seed).toContain("kraken-flow");
    expect(seed).toContain("x@test.com");
  });
});

describe("Kraken Lab wizard validation", () => {
  it("accepts a complete cohort configuration", () => {
    const cohort = sampleCohort();
    expect(validateFullCohort(cohort)).toHaveLength(0);
    expect(canAdvanceWizardStep("dificultad", cohort)).toBe(true);
  });

  it("requires scenario context on the project step", () => {
    const issues = validateFullCohort(
      sampleCohort({ scenarioContext: { text: "corto" } }),
    );
    expect(issues.some((issue) => issue.field === "scenarioContext.text")).toBe(true);
  });

  it("requires project other text when project is otro", () => {
    const issues = validateFullCohort(
      sampleCohort({ project: "otro", projectOther: "" }),
    );
    expect(issues.some((i) => i.field === "projectOther")).toBe(true);
  });

  it("requires valid pasante email and phone", () => {
    const cohort = sampleCohort({
      participants: [
        {
          fullName: "Test",
          age: 20,
          city: "CDMX",
          simulationCities: [],
          phone: "123",
          email: "bad-email",
        },
      ],
    });
    const issues = validateFullCohort(cohort);
    expect(issues.some((i) => i.field.includes("phone"))).toBe(true);
    expect(issues.some((i) => i.field.includes("email"))).toBe(true);
  });
});
