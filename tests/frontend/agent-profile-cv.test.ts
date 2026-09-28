import { describe, expect, it } from "vitest";
import {
  applyCvParseToProfile,
  parseCvFieldsFromText,
} from "@/lib/frontend/agent-profile";

describe("agent CV parse", () => {
  it("extracts email, phone, age, and name from labeled CV text", () => {
    const parsed = parseCvFieldsFromText(`
      Nombre: Ana Lucía Soto
      Edad: 29
      Correo: ana.soto@empresa.mx
      Teléfono: +52 55 1234 5678
      Experiencia en ventas B2B
    `);
    expect(parsed.firstName).toBe("Ana");
    expect(parsed.lastName).toContain("Soto");
    expect(parsed.email).toBe("ana.soto@empresa.mx");
    expect(parsed.phone).toMatch(/55/);
    expect(parsed.age).toBe(29);
  });

  it("autofills only empty profile fields", () => {
    const merged = applyCvParseToProfile(
      {
        firstName: "Pedro",
        lastName: "",
        age: null,
        email: "pedro@test.com",
        phone: "",
      },
      {
        firstName: "Ana",
        lastName: "López",
        email: "ana@test.com",
        phone: "55 1111 2222",
        age: 30,
      },
    );
    expect(merged.firstName).toBe("Pedro");
    expect(merged.lastName).toBe("López");
    expect(merged.email).toBe("pedro@test.com");
    expect(merged.phone).toMatch(/1111/);
    expect(merged.age).toBe(30);
  });
});
