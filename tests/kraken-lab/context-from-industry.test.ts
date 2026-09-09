import { describe, expect, it } from "vitest";
import { INDUSTRY_OPTIONS } from "@/lib/scenarios/select-options";
import {
  buildIndustryAwareBrief,
  mergeScenarioContextUpload,
  parseStructuredBrief,
  savedFilesBannerMessage,
} from "@/lib/kraken-lab/context-from-industry";

describe("context-from-industry", () => {
  it("exposes at least 30 LATAM industry options before Otro", () => {
    expect(INDUSTRY_OPTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("rewrites Industria and Problema while keeping Cliente and Producto", () => {
    const existing = [
      "Cliente: Valeria Soto (Directora de Compras) · Importadora del Norte",
      "Industria: Importación y distribución",
      "Producto/servicio: Kraken Flow — plataforma de flujo comercial B2B",
      "Problema: Pedidos urgentes se atascan entre ventas y almacén.",
    ].join("\n");

    const next = buildIndustryAwareBrief({
      industry: "Logística y transporte",
      existingText: existing,
      fileTexts: ["Entregas urgentes se retrasan por falta de visibilidad entre tráfico y almacén."],
    });

    const parsed = parseStructuredBrief(next);
    expect(parsed.cliente).toContain("Valeria Soto");
    expect(parsed.producto).toContain("Kraken Flow");
    expect(parsed.industria).toBe("Logística y transporte");
    expect(parsed.problema?.length ?? 0).toBeGreaterThanOrEqual(30);
    expect(next.length).toBeGreaterThanOrEqual(30);
  });

  it("merges stored files when incoming draft lost the file list", () => {
    const merged = mergeScenarioContextUpload(
      {
        text: "Brief con texto suficiente para validación del escenario de prueba.",
      },
      {
        text: "",
        files: [{ id: "f1", name: "brief.txt", text: "Objeción ERP" }],
      },
    );

    expect(merged.files).toHaveLength(1);
    expect(merged.files?.[0]?.name).toBe("brief.txt");
  });

  it("formats the saved files banner copy", () => {
    expect(savedFilesBannerMessage(2)).toBe(
      "Ya tienes 2 archivo(s) guardado(s) para este proyecto. ¿Quieres agregar o borrar alguno?",
    );
  });
});
