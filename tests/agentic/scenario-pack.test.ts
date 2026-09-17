import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";
import { buildAuthoredScenarioConfig } from "@/lib/scenarios/authoring";

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
      rounds: [
        {
          key: "apertura",
          label: "Apertura",
          goal: "Presentarse y reconocer retrasos",
          clientPrompt: "Estoy ocupada, ¿de qué se trata?",
          positiveCriteria: ["reconocimiento"],
          negativeCriteria: ["monologo"],
        },
      ],
    });

    const contextText =
      "La empresa mueve 120 contenedores al mes. El KPI clave es OTIF sobre 95%.";

    const pack = buildScenarioPack(config, contextText, {
      companyContext: "Importadora del Norte · CDMX",
      clientTitle: "Directora de operaciones",
      clientName: "Valeria Soto",
    });

    expect(pack.product).toBe("Software de rutas");
    expect(pack.companyContext).toBe("Importadora del Norte · CDMX");
    expect(pack.clientTitle).toBe("Directora de operaciones");
    expect(pack.industry).toBe("Importadora del Norte");
    expect(pack.winCriteria).toBe("Demo con gerente de operaciones");
    expect(pack.objections).toContain("Ya tenemos TMS");
    expect(pack.facts.some((fact) => fact.includes("Entregas tardías"))).toBe(true);
    expect(pack.facts.some((fact) => fact.includes("Importadora del Norte"))).toBe(true);
    expect(pack.snippets.some((snippet) => snippet.text.includes("120 contenedores"))).toBe(
      true,
    );
    expect(pack.snippets.some((snippet) => snippet.source === "round")).toBe(true);
    expect(pack.contextText).toBe(contextText);
  });

  it("includes all authored scenario fields in the pack", () => {
    const input = {
      industry: "taller de llantas",
      productSold: "llantas premium",
      clientName: "Carlos Ruiz",
      clientTitle: "Dueño",
      companyContext: "Taller Norte",
      temperament: "Escéptico",
      difficultyLabel: "Media",
      clientProblem: "rotación lenta en temporada baja",
      objections: ["Ya tengo proveedor", "Márgenes apretados"],
      winCriteria: "Visita al taller el martes a las 10",
      callType: "discovery" as const,
    };
    const config = buildAuthoredScenarioConfig(input);
    const pack = buildScenarioPack(config, config.agentic?.scenarioContextText, {
      companyContext: input.companyContext,
      clientTitle: input.clientTitle,
    });

    expect(config.agentic?.scenarioContextText).toContain("Taller Norte");
    expect(config.agentic?.scenarioContextText).toContain("llantas premium");
    expect(pack.companyContext).toBe("Taller Norte");
    expect(pack.snippets.some((snippet) => snippet.text.includes("rotación lenta"))).toBe(
      true,
    );
    expect(
      pack.snippets.some(
        (snippet) => snippet.source === "round" && snippet.text.length >= 12,
      ),
    ).toBe(true);
  });
});
