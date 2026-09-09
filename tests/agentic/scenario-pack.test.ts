import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";

describe("buildScenarioPack", () => {
  it("builds facts and snippets from scenario config and context text", () => {
    const config = buildScenarioConfig({
      industry: "Importadora del Norte",
      productSold: "Software de rutas",
      clientProblem: "Entregas tardías en temporada alta",
      objections: ["Ya tenemos TMS", "Presupuesto cerrado"],
      winCriteria: "Demo con gerente de operaciones",
      temperament: "Escéptica",
      clientName: "Valeria Soto",
    });

    const contextText =
      "La empresa mueve 120 contenedores al mes. El KPI clave es OTIF sobre 95%.";

    const pack = buildScenarioPack(config, contextText);

    expect(pack.product).toBe("Software de rutas");
    expect(pack.objections).toContain("Ya tenemos TMS");
    expect(pack.facts.some((fact) => fact.includes("Entregas tardías"))).toBe(true);
    expect(pack.snippets.some((snippet) => snippet.text.includes("120 contenedores"))).toBe(
      true,
    );
    expect(pack.contextText).toBe(contextText);
  });
});
