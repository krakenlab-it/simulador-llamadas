import { describe, expect, it } from "vitest";
import {
  formatSimulationCitiesInput,
  parseSimulationCitiesInput,
  toggleSimulationCity,
} from "@/lib/kraken-lab/simulation-cities";
import { canAdvanceWizardStep, validateWizardStep } from "@/lib/kraken-lab/validation";
import type { PasanteProfile } from "@/lib/kraken-lab/types";

const completeProfile = (overrides: Partial<PasanteProfile> = {}): PasanteProfile => ({
  fullName: "Karen Galindo Narinan",
  age: 28,
  city: "Ciudad de México",
  simulationCities: ["Monterrey"],
  phone: "",
  email: "karen@example.com",
  ...overrides,
});

describe("simulation cities input", () => {
  it("parses comma-separated cities on commit", () => {
    expect(parseSimulationCitiesInput("Monterrey, Guadalajara")).toEqual([
      "Monterrey",
      "Guadalajara",
    ]);
    expect(parseSimulationCitiesInput("Monterrey,")).toEqual(["Monterrey"]);
  });

  it("formats cities for display without dropping trailing commas while editing separately", () => {
    expect(formatSimulationCitiesInput(["Monterrey", "Guadalajara"])).toBe(
      "Monterrey, Guadalajara",
    );
  });

  it("toggles chip selections in the city list", () => {
    expect(toggleSimulationCity(["Monterrey"], "Guadalajara")).toEqual([
      "Monterrey",
      "Guadalajara",
    ]);
    expect(toggleSimulationCity(["Monterrey", "Guadalajara"], "Monterrey")).toEqual([
      "Guadalajara",
    ]);
  });
});

describe("participant phone validation", () => {
  it("allows advancing with an empty optional phone", () => {
    expect(
      validateWizardStep("perfiles", {
        participants: [completeProfile({ phone: "" })],
      }).some((issue) => issue.field.includes("phone")),
    ).toBe(false);

    expect(
      canAdvanceWizardStep("perfiles", {
        participants: [completeProfile({ phone: "" })],
      }),
    ).toBe(true);
  });

  it("still validates non-empty phone numbers", () => {
    expect(
      validateWizardStep("perfiles", {
        participants: [completeProfile({ phone: "123" })],
      }).some((issue) => issue.field.includes("phone")),
    ).toBe(true);
  });
});
