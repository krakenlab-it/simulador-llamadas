import { describe, expect, it } from "vitest";
import {
  buildKrakenScenario,
  generateReceiverPersonas,
} from "@/lib/kraken-lab/generator";
import {
  corpusKeywordOverlap,
  deriveIndustryFromCorpus,
} from "@/lib/kraken-lab/context-anchors";
import { SeededRng } from "@/lib/kraken-lab/seed";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";
import { getClientBySlug } from "@/lib/clients";

const SAMPLE_CONTEXT =
  "Vendemos software de inventarios a directoras de compras. Objeciones: ya tenemos proveedor y no hay presupuesto.";

function sampleCohort(overrides: Partial<KrakenLabCohortConfig> = {}): KrakenLabCohortConfig {
  const seed = overrides.sessionSeed ?? "anchor-seed-123";
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

describe("Kraken generator context anchoring", () => {
  it("anchors personas to uploaded context instead of unrelated pools", () => {
    const cohort = sampleCohort({ sessionSeed: "anchor-personas-seed" });
    const persona = cohort.receiverPersonas[0];

    expect(persona.role.toLowerCase()).toContain("compras");
    expect(
      corpusKeywordOverlap(SAMPLE_CONTEXT, [persona.extras.industry, ...persona.painPoints]),
    ).toBeGreaterThan(0);

    const unrelated = deriveIndustryFromCorpus(
      "Hospital privado con urgencias nocturnas y pacientes críticos",
      new SeededRng("other"),
    );
    expect(unrelated.toLowerCase()).not.toBe(persona.extras.industry.toLowerCase());
  });

  it("builds scenario product and objections from dialogue fields and brief", () => {
    const scenario = buildKrakenScenario(sampleCohort({ sessionSeed: "anchor-scenario-seed" }));

    expect(scenario.config.productSold.toLowerCase()).toContain("inventarios");
    expect(scenario.config.clientProblem.toLowerCase()).toMatch(/compras|demo|llamada/);
    expect(scenario.config.objections.join(" ").toLowerCase()).toContain("proveedor");
    expect(scenario.config.agentic?.scenarioContextText).toContain("Software de inventarios");
    expect(scenario.config.agentic?.scenarioContextText).toContain(SAMPLE_CONTEXT);
  });

  it("keeps clinic presets unchanged", () => {
    expect(getClientBySlug("mariana")?.name).toBe("Mariana Escobedo");
    expect(getClientBySlug("rodrigo")?.name).toBe("Rodrigo Nava");
    expect(getClientBySlug("efrain")?.name).toBe("Efraín Loera");
  });
});
