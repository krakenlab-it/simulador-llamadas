import { describe, expect, it } from "vitest";
import {
  generateReceiverPersonas,
  mintFreshSessionSeed,
} from "@/lib/kraken-lab/generator";
import { isBlockedPersonaName } from "@/lib/kraken-lab/persona-pools";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";
import { getClientBySlug } from "@/lib/clients";

function baseCohort(sessionSeed: string): KrakenLabCohortConfig {
  return {
    project: "kraken-flow",
    scenarioContext: {
      text: "Vendemos Kraken Flow a importadoras del norte: pedidos urgentes se atascan entre ventas y almacén. Objeciones comunes: ya tenemos ERP.",
    },
    participantCount: 1,
    participants: [
      {
        fullName: "Ana Pasante",
        age: 22,
        city: "Monterrey",
        simulationCities: ["Monterrey", "Saltillo"],
        phone: "3312345678",
        email: "ana@example.com",
      },
    ],
    simulationFocuses: ["ventas"],
    simulatorRole: "caller",
    roleObjective: "Agendar mesa de trabajo con compras y operaciones",
    dialogueTypes: [
      {
        focus: "ventas",
        simulationContext: "Llamada fría B2B",
        realObjective: "Piloto de 3 semanas",
        productServiceExplanation: "Kraken Flow — plataforma de flujo comercial",
      },
    ],
    receiverPersonas: [],
    selectedPersonaId: undefined,
    difficultyLevel: 2,
    sessionSeed,
  };
}

describe("Kraken Lab persona generation", () => {
  it("generates three rich personas without clinic preset names", () => {
    const personas = generateReceiverPersonas(baseCohort("seed-a"), 3);

    expect(personas).toHaveLength(3);
    for (const persona of personas) {
      expect(persona.difficultyLabel.length).toBeGreaterThan(0);
      expect(persona.indicator).toMatch(/^Indicador:/);
      expect(persona.painPoints.length).toBeGreaterThan(0);
      expect(persona.temperament.length).toBeGreaterThan(0);
      expect(isBlockedPersonaName(persona.name)).toBe(false);
    }

    const names = personas.map((persona) => persona.name);
    expect(new Set(names).size).toBe(3);
  });

  it("produces different persona name sets on consecutive fresh seeds", () => {
    const first = generateReceiverPersonas(
      baseCohort(mintFreshSessionSeed()),
      3,
    ).map((persona) => persona.name);
    const second = generateReceiverPersonas(
      baseCohort(mintFreshSessionSeed()),
      3,
    ).map((persona) => persona.name);

    expect(first.join("|")).not.toBe(second.join("|"));
  });

  it("keeps clinic presets unchanged", () => {
    expect(getClientBySlug("mariana")?.name).toBe("Mariana Escobedo");
    expect(getClientBySlug("rodrigo")?.name).toBe("Rodrigo Nava");
    expect(getClientBySlug("efrain")?.name).toBe("Efraín Loera");
  });
});
