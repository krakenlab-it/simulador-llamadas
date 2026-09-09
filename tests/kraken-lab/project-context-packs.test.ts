import { describe, expect, it } from "vitest";
import {
  migrateLegacyProjectContextPacks,
  switchProjectContextPack,
  updateActiveProjectScenarioContext,
} from "@/lib/kraken-lab/project-context-packs";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";

const SIMULADOR_FILES = {
  text: "Contexto de Simulador de Llamadas",
  files: [
    {
      id: "sim-1",
      name: "simulador-brief.txt",
      text: "Objeción: ya tenemos CRM.",
    },
  ],
};

describe("project context packs", () => {
  it("keeps uploaded files scoped to the selected project when switching", () => {
    let draft: Partial<KrakenLabCohortConfig> = {
      project: "simulador-llamadas",
      scenarioContext: { text: "" },
    };

    draft = updateActiveProjectScenarioContext(draft, SIMULADOR_FILES);
    expect(draft.scenarioContext?.files?.[0]?.name).toBe("simulador-brief.txt");

    draft = switchProjectContextPack(draft, "me-we");
    expect(draft.project).toBe("me-we");
    expect(draft.scenarioContext?.text ?? "").toBe("");
    expect(draft.scenarioContext?.files ?? []).toHaveLength(0);

    draft = switchProjectContextPack(draft, "simulador-llamadas");
    expect(draft.scenarioContext?.files?.[0]?.name).toBe("simulador-brief.txt");
    expect(draft.scenarioContext?.text).toContain("Simulador de Llamadas");
  });

  it("does not copy files from project A into project B packs", () => {
    const draftA = updateActiveProjectScenarioContext(
      { project: "simulador-llamadas", scenarioContext: { text: "" } },
      SIMULADOR_FILES,
    );

    const draftB = switchProjectContextPack(draftA, "global-green");
    expect(draftB.scenarioContextByProject?.["simulador-llamadas"]?.files?.[0]?.name).toBe(
      "simulador-brief.txt",
    );
    expect(draftB.scenarioContextByProject?.["global-green"]).toBeUndefined();
    expect(draftB.scenarioContext?.files ?? []).toHaveLength(0);
  });

  it("migrates legacy top-level scenarioContext into the active project pack once", () => {
    const migrated = migrateLegacyProjectContextPacks({
      project: "simulador-llamadas",
      scenarioContext: SIMULADOR_FILES,
      contextIndustry: "Software B2B",
    });

    expect(migrated.scenarioContextByProject?.["simulador-llamadas"]?.text).toContain(
      "Simulador de Llamadas",
    );
    expect(migrated.contextIndustryByProject?.["simulador-llamadas"]).toBe("Software B2B");
    expect(migrated.scenarioContext?.text).toContain("Simulador de Llamadas");
  });

  it("does not assign legacy context to a different project after migration", () => {
    const migrated = migrateLegacyProjectContextPacks({
      project: "me-we",
      scenarioContext: SIMULADOR_FILES,
    });

    expect(migrated.scenarioContextByProject?.["me-we"]?.text).toContain(
      "Simulador de Llamadas",
    );
    expect(migrated.scenarioContextByProject?.["simulador-llamadas"]).toBeUndefined();
  });
});
