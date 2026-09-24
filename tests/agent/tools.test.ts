import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent";
import {
  createToolSession,
  executeApplyScenario,
  executeListCatalog,
  executePatchDraft,
  executeProposeScenario,
  executeResetDraft,
} from "@/lib/agent/tools";

function session() {
  return createToolSession({
    draft: null,
    catalog: [
      {
        slug: "mariana",
        clientName: "Mariana Escobedo",
        clientTitle: "Directora",
        industry: "Vivienda",
        isPreset: true,
      },
    ],
    settings: DEFAULT_AGENT_SETTINGS,
    teamId: null,
    testId: null,
  });
}

describe("agent tools", () => {
  it("lists catalog, proposes, patches, applies and resets", () => {
    const current = session();
    expect(executeListCatalog(current).catalog).toHaveLength(1);

    const proposed = executeProposeScenario(current, {
      clientName: "Laura",
      clientTitle: "Gerente",
      companyContext: "Banco regional",
      industry: "Banca",
      productSold: "Pauta digital",
      clientProblem: "No quiere pauta digital",
    });
    expect(proposed.ok).toBe(true);
    expect(current.draft?.clientName).toBe("Laura");

    const patched = executePatchDraft(current, { clientTitle: "Directora" });
    expect(patched.ok).toBe(true);
    expect(current.draft?.clientTitle).toBe("Directora");

    const applied = executeApplyScenario(current, { confirm: true });
    expect(applied.ok).toBe(true);
    expect(current.appliedInput?.industry).toBe("Banca");

    executeResetDraft(current);
    expect(current.draft?.clientName).toBe("");
    expect(current.appliedInput).toBeNull();
  });
});
