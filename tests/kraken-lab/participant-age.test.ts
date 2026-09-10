import { describe, expect, it } from "vitest";
import {
  canAdvanceWizardStep,
  defaultPasanteProfile,
  validateWizardStep,
} from "@/lib/kraken-lab/validation";
import { hydrateWizardDraft } from "@/lib/kraken-lab/wizard-draft-storage";

describe("participant age defaults and validation", () => {
  it("starts new profiles with age 0 (blank in the UI)", () => {
    expect(defaultPasanteProfile().age).toBe(0);
  });

  it("blocks advancing profiles step until age is between 16 and 80", () => {
    expect(
      validateWizardStep("perfiles", {
        participants: [defaultPasanteProfile()],
      }).some((issue) => issue.field.includes("age")),
    ).toBe(true);

    expect(
      canAdvanceWizardStep("perfiles", {
        participants: [
          {
            ...defaultPasanteProfile(),
            fullName: "Santiago Mendoza",
            age: 28,
            city: "Ciudad de México",
            phone: "+52 55 1234 5678",
            email: "santiago@example.com",
          },
        ],
      }),
    ).toBe(true);
  });

  it("hydrates missing participant age as 0 instead of 22", () => {
    const hydrated = hydrateWizardDraft({
      version: 1,
      savedAt: "2026-09-09T12:00:00.000Z",
      step: "perfiles",
      mode: "texto",
      draft: {
        participants: [
          {
            fullName: "Santiago Mendoza",
            city: "",
            simulationCities: [],
            phone: "",
            email: "",
          },
        ],
      },
    });

    expect(hydrated?.draft.participants?.[0]?.age).toBe(0);
  });
});
