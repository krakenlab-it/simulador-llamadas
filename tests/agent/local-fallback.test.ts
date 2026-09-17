import { describe, expect, it } from "vitest";
import { runLocalAgentTurn } from "@/lib/agent/local-fallback";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import { validateAuthoringDraft } from "@/lib/scenarios/authoring";
import type { AgentChatMessage, AgentToolSession } from "@/lib/agent/types";

function session(): AgentToolSession {
  return {
    draft: null,
    catalog: [],
    settings: DEFAULT_AGENT_SETTINGS,
    appliedInput: null,
  };
}

function user(content: string): AgentChatMessage {
  return { id: "u1", role: "user", content };
}

describe("local conversation → scenario fallback", () => {
  it("builds a valid bank scenario from one sentence", () => {
    const current = session();
    const result = runLocalAgentTurn({
      messages: [user("Crea un gerente de banco que no quiere pauta digital")],
      session: current,
    });

    expect(current.draft).not.toBeNull();
    expect(validateAuthoringDraft(current.draft!)).toBeNull();
    expect(current.draft?.industry).toBe("banca");
    expect(current.draft?.clientProblem.toLowerCase()).toContain("pauta");
    expect(result.traces.some((trace) => trace.toolId === "propose_scenario")).toBe(
      true,
    );
    expect(result.text).toContain(current.draft?.clientName ?? "missing");
  });

  it("applies the draft when the user asks to save", () => {
    const current = session();
    runLocalAgentTurn({
      messages: [user("Crea un gerente de banco que no quiere pauta digital")],
      session: current,
    });
    const saved = runLocalAgentTurn({
      messages: [
        user("Crea un gerente de banco que no quiere pauta digital"),
        { id: "a1", role: "assistant", content: "Armé el caso" },
        user("guárdalo"),
      ],
      session: current,
    });

    expect(current.appliedInput?.industry).toBe("banca");
    expect(saved.traces.some((trace) => trace.toolId === "apply_scenario")).toBe(
      true,
    );
  });
});
