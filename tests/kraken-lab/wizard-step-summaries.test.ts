import { describe, expect, it } from "vitest";
import { summarizeKrakenWizardStep } from "@/lib/kraken-lab/wizard-step-summaries";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";

describe("summarizeKrakenWizardStep", () => {
  const draft: Partial<KrakenLabCohortConfig> = {
    project: "simulador-llamadas",
    participantCount: 2,
    participants: [
      {
        fullName: "Ana Pasante",
        age: 22,
        city: "Guadalajara",
        simulationCities: ["Monterrey"],
        phone: "3312345678",
        email: "ana@example.com",
      },
      {
        fullName: "Luis Demo",
        age: 24,
        city: "CDMX",
        simulationCities: [],
        phone: "5512345678",
        email: "luis@example.com",
      },
    ],
    simulationFocuses: ["ventas"],
    simulatorRole: "caller",
    roleObjective: "Agendar reunión con día y hora",
    dialogueTypes: [
      {
        focus: "ventas",
        simulationContext: "Llamada fría a director de compras",
        realObjective: "Conseguir demo",
        productServiceExplanation: "Software de inventarios",
      },
    ],
    receiverPersonas: [
      {
        id: "p1",
        name: "Valeria Soto",
        age: 40,
        gender: "femenino",
        role: "Directora de compras",
        company: "Retail Norte",
        city: "Monterrey",
        moods: ["ocupado"],
        homeStress: 2,
        workStress: 6,
        attentionStates: ["ocupado"],
        difficultyLabel: "Media",
        indicator: "Indicador: Rotación de inventario",
        painPoints: ["Presupuesto apretado"],
        temperament: "Escéptica",
        extras: {
          industry: "Retail",
          objectionStyle: "Escéptico",
          patienceLevel: "Media",
        },
      },
    ],
    selectedPersonaId: "p1",
    difficultyLevel: 2,
    scenarioContext: {
      text: "Vendemos software de inventarios a directoras de compras en retail.",
    },
  };

  it("summarizes project step with context", () => {
    const summary = summarizeKrakenWizardStep(
      "proyecto",
      draft,
      "texto",
      "simulador-llamadas",
    );
    expect(summary).toContain("Simulador de Llamadas");
    expect(summary).toContain("software de inventarios");
  });

  it("summarizes cohort size and mode", () => {
    expect(summarizeKrakenWizardStep("participantes", draft, "voz")).toContain(
      "2 participante(s)",
    );
    expect(summarizeKrakenWizardStep("participantes", draft, "voz")).toContain(
      "Voz",
    );
  });

  it("summarizes personas and difficulty", () => {
    expect(summarizeKrakenWizardStep("personas", draft, "texto")).toContain(
      "Valeria Soto",
    );
    expect(summarizeKrakenWizardStep("dificultad", draft, "texto")).toContain(
      "Intermedio",
    );
  });

  it("returns empty summary for incomplete steps", () => {
    expect(
      summarizeKrakenWizardStep("perfiles", { participantCount: 1, participants: [] }, "texto"),
    ).toBe("");
  });
});
