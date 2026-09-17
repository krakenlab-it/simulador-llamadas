import { describe, expect, it } from "vitest";
import {
  AgentHarnessError,
  createAiSdkTools,
  createToolSession,
  runAgentChat,
} from "@/lib/agent/harness";
import { DEFAULT_AGENT_SETTINGS, parseAgentHarnessSettings } from "@/lib/agent/settings";
import { AGENT_TOOL_IDS } from "@/lib/agent/types";
import { validateAuthoringDraft } from "@/lib/scenarios/authoring";

describe("AI SDK harness", () => {
  it("uses the local fallback on auto when no model key is set", async () => {
    const response = await runAgentChat({
      messages: [
        {
          id: "u1",
          role: "user",
          content: "Crea un gerente de banco que no quiere pauta digital",
        },
      ],
      settings: parseAgentHarnessSettings({
        ...DEFAULT_AGENT_SETTINGS,
        runtime: "auto",
      }),
      catalog: [],
      draft: null,
    });

    expect(response.runtime).toBe("local");
    expect(response.provider).toBe("local");
    expect(response.draft).not.toBeNull();
    expect(validateAuthoringDraft(response.draft!)).toBeNull();
    expect(response.systemPromptUsed).toContain("Herramientas habilitadas");
  });

  it("fails visibly when AI SDK is forced without keys", async () => {
    const previous = {
      groq: process.env.GROQ_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      gateway: process.env.AI_GATEWAY_API_KEY,
    };
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;

    try {
      await expect(
        runAgentChat({
          messages: [{ id: "u1", role: "user", content: "hola" }],
          settings: parseAgentHarnessSettings({ runtime: "ai-sdk" }),
          catalog: [],
          draft: null,
        }),
      ).rejects.toBeInstanceOf(AgentHarnessError);
    } finally {
      if (previous.groq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previous.groq;
      if (previous.google === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = previous.google;
      if (previous.gateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
      else process.env.AI_GATEWAY_API_KEY = previous.gateway;
    }
  });

  it("only registers tools the frontend enabled", () => {
    const session = createToolSession({
      settings: parseAgentHarnessSettings({
        enabledTools: ["propose_scenario", "apply_scenario"],
      }),
      catalog: [],
      draft: null,
    });
    const tools = createAiSdkTools(session, session.settings.enabledTools);
    expect(Object.keys(tools).sort()).toEqual([
      "apply_scenario",
      "propose_scenario",
    ]);
    expect(session.settings.enabledTools).not.toEqual([...AGENT_TOOL_IDS]);
  });
});
