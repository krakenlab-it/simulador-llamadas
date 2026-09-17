import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import {
  executeApplyScenario,
  executeListCatalog,
  executePatchDraft,
  executeProposeScenario,
  executeResetDraft,
} from "@/lib/agent/tools";
import type { AgentToolSession } from "@/lib/agent/types";

function session(): AgentToolSession {
  return {
    draft: null,
    catalog: [
      {
        slug: "mariana",
        clientName: "Mariana Escobedo",
        clientTitle: "Directora",
        industry: "inmobiliaria",
        isPreset: true,
        language: "es",
      },
    ],
    settings: DEFAULT_AGENT_SETTINGS,
    appliedInput: null,
  };
}

describe("agent scenario tools", () => {
  it("lists the catalog from session context", () => {
    const current = session();
    expect(executeListCatalog(current)).toHaveLength(1);
    expect(executeListCatalog(current)[0]?.slug).toBe("mariana");
  });

  it("proposes a valid draft the app can persist", () => {
    const current = session();
    const result = executeProposeScenario(
      {
        clientName: "Laura Méndez",
        clientTitle: "Gerente",
        companyContext: "Cadena de gimnasios",
        industry: "gimnasios",
        productSold: "membresía anual",
        clientProblem: "baja retención",
        objections: ["Ya tengo agencia"],
      },
      current,
    );
    expect(result.valid).toBe(true);
    expect(current.draft?.clientName).toBe("Laura Méndez");

    const applied = executeApplyScenario({ confirm: true }, current);
    expect(applied.applied).toBe(true);
    expect(current.appliedInput?.clientName).toBe("Laura Méndez");
    expect(current.appliedInput?.industry).toBe("gimnasios");
  });

  it("patches a single field without dropping the rest", () => {
    const current = session();
    executeProposeScenario(
      {
        clientName: "Carlos",
        clientTitle: "Dueño",
        companyContext: "Taller Norte",
        industry: "llantas",
        productSold: "llantas premium",
        clientProblem: "rotación lenta",
      },
      current,
    );
    const patched = executePatchDraft({ clientProblem: "precio de mayoreo" }, current);
    expect(patched.draft.clientName).toBe("Carlos");
    expect(patched.draft.clientProblem).toBe("precio de mayoreo");
  });

  it("refuses to apply an empty draft and reset clears it", () => {
    const current = session();
    expect(executeApplyScenario({ confirm: true }, current).applied).toBe(false);
    executeProposeScenario(
      {
        clientName: "Ana",
        clientTitle: "CMO",
        companyContext: "Retail",
        industry: "retail",
        productSold: "pauta",
        clientProblem: "no mide",
      },
      current,
    );
    const reset = executeResetDraft(current);
    expect(reset.draft.clientName).toBe("");
    expect(current.appliedInput).toBeNull();
  });
});
