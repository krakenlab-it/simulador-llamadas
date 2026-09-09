import { describe, expect, it } from "vitest";
import { parseCvText, applyParsedCvToProfile } from "@/lib/kraken-lab/cv-parse";
import type { PasanteProfile } from "@/lib/kraken-lab/types";

const SAMPLE_CV = `
Santiago Mendoza
Ciudad de México
Teléfono: +52 55 1234 5678
Correo: santiago.mendoza@example.com
Edad: 28

Experiencia en ventas B2B en Monterrey y Guadalajara.
`.trim();

describe("parseCvText", () => {
  it("extracts email, phone, name, age, city, and simulation cities from sample CV text", () => {
    const parsed = parseCvText(SAMPLE_CV);

    expect(parsed.fullName).toBe("Santiago Mendoza");
    expect(parsed.email).toBe("santiago.mendoza@example.com");
    expect(parsed.phone).toMatch(/1234/);
    expect(parsed.age).toBe(28);
    expect(parsed.city).toMatch(/Ciudad de México|CDMX/i);
    expect(parsed.simulationCities).toEqual(
      expect.arrayContaining(["Monterrey", "Guadalajara"]),
    );
  });

  it("merges parsed fields into a participant profile", () => {
    const base: PasanteProfile = {
      fullName: "",
      age: 22,
      city: "",
      simulationCities: [],
      phone: "",
      email: "",
    };

    const next = applyParsedCvToProfile(base, parseCvText(SAMPLE_CV), "cv.txt");

    expect(next.fullName).toBe("Santiago Mendoza");
    expect(next.email).toBe("santiago.mendoza@example.com");
    expect(next.cvFileName).toBe("cv.txt");
  });
});
