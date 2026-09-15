import { describe, expect, it } from "vitest";
import {
  INDUSTRY_OPTIONS,
  MEXICO_PRIORITY_INDUSTRIES,
} from "@/lib/scenarios/select-options";
import {
  buildClientProblemForIndustry,
  buildIndustryAwareBrief,
  isIndustryDefaultClientProblem,
  mergeScenarioContextUpload,
  parseStructuredBrief,
  savedFilesBannerMessage,
} from "@/lib/kraken-lab/context-from-industry";

describe("context-from-industry", () => {
  it("lists Mexico-priority industries first and includes all required options", () => {
    expect(INDUSTRY_OPTIONS.slice(0, MEXICO_PRIORITY_INDUSTRIES.length)).toEqual([
      ...MEXICO_PRIORITY_INDUSTRIES,
    ]);
    for (const industry of MEXICO_PRIORITY_INDUSTRIES) {
      expect(INDUSTRY_OPTIONS).toContain(industry);
    }
  });

  it("builds industry-specific client problems for Mexico-priority labels", () => {
    for (const industry of MEXICO_PRIORITY_INDUSTRIES) {
      const problem = buildClientProblemForIndustry(industry);
      expect(problem.length).toBeGreaterThanOrEqual(30);
      expect(isIndustryDefaultClientProblem(problem, industry)).toBe(true);
    }
  });

  it("builds an industry-specific client problem for additional industries", () => {
    const problem = buildClientProblemForIndustry("Logística y transporte");
    expect(problem.length).toBeGreaterThanOrEqual(30);
    expect(problem.toLowerCase()).toContain("entreg");
    expect(isIndustryDefaultClientProblem(problem, "Logística y transporte")).toBe(true);
  });

  it("keeps event-related and insurance industries as separate brief templates", () => {
    const entretenimiento = buildClientProblemForIndustry("Entretenimiento, Gaming & Eventos");
    const eventos = buildClientProblemForIndustry("Empresa de eventos");
    const eventosMultiVertical = buildClientProblemForIndustry(
      "Empresas de eventos (turismo, alimentos, tecnología y otros)",
    );
    const seguros = buildClientProblemForIndustry("Compañías de Seguros");

    expect(entretenimiento.toLowerCase()).toContain("patrocin");
    expect(eventos.toLowerCase()).toContain("montaje");
    expect(eventosMultiVertical.toLowerCase()).toContain("feria");
    expect(seguros.toLowerCase()).toContain("siniestro");
    expect(new Set([entretenimiento, eventos, eventosMultiVertical, seguros]).size).toBe(4);
  });

  it("rewrites Industria and Problema while keeping Cliente and Producto", () => {
    const existing = [
      "Cliente: Valeria Soto (Directora de Compras) · Importadora del Norte",
      "Industria: Importación y distribución",
      "Producto/servicio: Kraken Flow — plataforma de flujo comercial B2B",
      "Problema: Pedidos urgentes se atascan entre ventas y almacén.",
    ].join("\n");

    const next = buildIndustryAwareBrief({
      industry: "Retail & Supermercados",
      existingText: existing,
      fileTexts: ["Inventario desalineado genera quiebres de stock en piso de venta."],
    });

    const parsed = parseStructuredBrief(next);
    expect(parsed.cliente).toContain("Valeria Soto");
    expect(parsed.producto).toContain("Kraken Flow");
    expect(parsed.industria).toBe("Retail & Supermercados");
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
