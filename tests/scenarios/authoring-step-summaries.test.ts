import { describe, expect, it } from "vitest";
import {
  emptyAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";
import { summarizeAuthoringStep } from "@/lib/scenarios/authoring-step-summaries";

describe("summarizeAuthoringStep", () => {
  const filled: ScenarioAuthoringDraft = {
    ...emptyAuthoringDraft("es"),
    industry: "Retail",
    productSold: "Software de rutas",
    clientName: "Carlos Ruiz",
    clientTitle: "Gerente",
    companyContext: "Operaciones Norte",
    clientProblem: "Entregas tardías",
    winCriteria: "Visita martes 10:00",
    objections: ["Ya tenemos TMS", "Sin presupuesto"],
    callType: "discovery",
    rounds: [
      {
        key: "apertura",
        label: "Apertura",
        goal: "Presentarse",
        clientPrompt: "¿Quién habla?",
        positiveCriteria: ["reconocimiento"],
        negativeCriteria: ["monologo"],
      },
      {
        key: "cierre",
        label: "Cierre",
        goal: "Fijar hora",
        clientPrompt: "Tengo prisa",
        positiveCriteria: ["dia_hora"],
        negativeCriteria: ["telegrama"],
      },
    ],
  };

  it("summarizes persona fields", () => {
    const summary = summarizeAuthoringStep("persona", filled);
    expect(summary).toContain("Carlos Ruiz");
    expect(summary).toContain("Software de rutas");
    expect(summary).toContain("Entregas tardías");
  });

  it("summarizes beats and success criteria", () => {
    expect(summarizeAuthoringStep("beats", filled)).toContain("2 fase(s)");
    expect(summarizeAuthoringStep("beats", filled)).toContain("Apertura");
    expect(summarizeAuthoringStep("success", filled)).toContain("Visita martes");
    expect(summarizeAuthoringStep("success", filled)).toContain("2 objeción(es)");
  });

  it("returns empty when step has no filled data", () => {
    expect(summarizeAuthoringStep("persona", emptyAuthoringDraft("es"))).toBe("");
  });
});
