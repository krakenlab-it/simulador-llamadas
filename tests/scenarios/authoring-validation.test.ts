import { describe, expect, it } from "vitest";
import {
  emptyAuthoringDraft,
  issuesForAuthoringStep,
  listAuthoringDraftIssues,
} from "@/lib/scenarios/authoring";
import { OTHER_OPTION_VALUE } from "@/lib/scenarios/select-options";

function filledDraft() {
  const draft = emptyAuthoringDraft("es");
  return {
    ...draft,
    industry: "taller de llantas",
    productSold: "llantas premium",
    clientName: "Carlos Ruiz",
    clientTitle: "Dueño",
    companyContext: "Taller Norte",
    clientProblem: "rotación lenta en temporada baja",
    winCriteria: "Visita al taller el martes a las 10",
  };
}

describe("listAuthoringDraftIssues", () => {
  it("flags __otro__ productSold with an Otro-specific message", () => {
    const issues = listAuthoringDraftIssues({
      ...filledDraft(),
      productSold: OTHER_OPTION_VALUE,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: "productSold",
        step: "persona",
        message: "Falta qué se vende (escribe tu valor en Otro).",
      }),
    );
  });

  it("flags empty clientName on the persona step", () => {
    const issues = listAuthoringDraftIssues({
      ...filledDraft(),
      clientName: "",
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: "clientName",
        message: "Falta nombre del cliente.",
      }),
    );
    expect(issuesForAuthoringStep("persona", { ...filledDraft(), clientName: "" }).length).toBeGreaterThan(0);
  });

  it("returns no issues for a complete draft", () => {
    expect(listAuthoringDraftIssues(filledDraft())).toEqual([]);
  });
});
