import { describe, expect, it } from "vitest";
import {
  applyParsedCvToProfile,
  extractNameFromFileName,
  parseCvFile,
  parseCvText,
} from "@/lib/kraken-lab/cv-parse";
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

  it("parses ALL CAPS name lines", () => {
    const parsed = parseCvText(`
SANTIAGO JANIEL MENDOZA CORTES
Edad: 24
`.trim());

    expect(parsed.fullName).toBe("Santiago Janiel Mendoza Cortes");
    expect(parsed.age).toBe(24);
  });

  it("parses age from años and dd/mm/yyyy formats", () => {
    expect(parseCvText("MARIA LOPEZ\n28 años").age).toBe(28);
    expect(parseCvText("JOHN DOE\n32 years old").age).toBe(32);
    expect(parseCvText("ANA RUIZ\n15/03/1998").age).toBe(
      new Date().getFullYear() - 1998,
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

  it("overwrites profile age 0 with parsed age", () => {
    const base: PasanteProfile = {
      fullName: "",
      age: 0,
      city: "",
      simulationCities: [],
      phone: "",
      email: "",
    };

    const next = applyParsedCvToProfile(
      base,
      parseCvText("Santiago Mendoza\nEdad: 31"),
      "cv.txt",
    );

    expect(next.age).toBe(31);
  });
});

describe("extractNameFromFileName", () => {
  it("derives full name from Santiago Janiel Mendoza Cortes CV.pdf", () => {
    expect(extractNameFromFileName("Santiago Janiel Mendoza Cortes CV.pdf")).toBe(
      "Santiago Janiel Mendoza Cortes",
    );
  });

  it("strips resume markers, extension, and separators", () => {
    expect(extractNameFromFileName("maria_de_la_cruz-curriculum.pdf")).toBe(
      "Maria de la Cruz",
    );
  });
});

describe("parseCvFile", () => {
  it("falls back to filename when PDF text extraction is empty", async () => {
    const file = {
      name: "Santiago Janiel Mendoza Cortes CV.pdf",
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(8),
    };

    const result = await parseCvFile(file);

    expect(result.parsed.fullName).toBe("Santiago Janiel Mendoza Cortes");
    expect(result.nameFromFileName).toBe(true);
    expect(result.limited).toBe(true);
  });
});
