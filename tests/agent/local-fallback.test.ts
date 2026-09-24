import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SETTINGS, runAgentChat } from "@/lib/agent";

describe("local agent fallback", () => {
  it("drafts a bank scenario from one Spanish sentence", async () => {
    const response = await runAgentChat({
      messages: [
        {
          role: "user",
          content: "Crea un gerente de banco que no quiere pauta digital",
        },
      ],
      settings: { ...DEFAULT_AGENT_SETTINGS, runtime: "local" },
      catalog: [],
      draft: null,
    });
    expect(response.runtime).toBe("local");
    expect(response.provider).toBe("local");
    expect(response.draft?.industry).toMatch(/Banca/i);
    expect(response.draft?.clientProblem).toMatch(/pauta digital/i);
    expect(response.traces.some((trace) => trace.toolId === "propose_scenario")).toBe(
      true,
    );
  });

  it("applies the draft when the user says guárdalo", async () => {
    const first = await runAgentChat({
      messages: [
        {
          role: "user",
          content: "Crea un gerente de banco que no quiere pauta digital",
        },
      ],
      settings: { ...DEFAULT_AGENT_SETTINGS, runtime: "local" },
      catalog: [],
      draft: null,
    });
    const second = await runAgentChat({
      messages: [
        {
          role: "user",
          content: "Crea un gerente de banco que no quiere pauta digital",
        },
        first.assistantMessage,
        { role: "user", content: "guárdalo" },
      ],
      settings: { ...DEFAULT_AGENT_SETTINGS, runtime: "local" },
      catalog: [],
      draft: first.draft,
    });
    expect(second.appliedInput?.industry).toMatch(/Banca/i);
    expect(second.appliedInput?.clientProblem).toMatch(/pauta digital/i);
    expect(second.state).toBe("ready");
  });
});
