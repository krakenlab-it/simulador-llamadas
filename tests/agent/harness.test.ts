import { afterEach, describe, expect, it } from "vitest";
import {
  AgentHarnessError,
  DEFAULT_AGENT_SETTINGS,
  runAgentChat,
} from "@/lib/agent";

const savedDeepseek = process.env.DEEPSEEK_API_KEY;
const savedGroq = process.env.GROQ_API_KEY;
const savedGoogle = process.env.GOOGLE_API_KEY;

afterEach(() => {
  if (savedDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = savedDeepseek;
  if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = savedGroq;
  if (savedGoogle === undefined) delete process.env.GOOGLE_API_KEY;
  else process.env.GOOGLE_API_KEY = savedGoogle;
});

describe("runAgentChat", () => {
  it("uses local runtime when auto has no keys", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const response = await runAgentChat({
      messages: [{ role: "user", content: "arma un caso de farmacia" }],
      settings: DEFAULT_AGENT_SETTINGS,
      catalog: [],
      draft: null,
    });
    expect(response.runtime).toBe("local");
    expect(response.roles.agent).toMatch(/agente/i);
    expect(response.roles.user).toMatch(/vendedor/i);
    expect(response.systemPromptUsed).toContain("CANAL AGENTE");
  });

  it("throws when AI SDK is forced without keys", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    await expect(
      runAgentChat({
        messages: [{ role: "user", content: "hola" }],
        settings: { ...DEFAULT_AGENT_SETTINGS, runtime: "ai-sdk" },
        catalog: [],
        draft: null,
      }),
    ).rejects.toBeInstanceOf(AgentHarnessError);
  });

  it("rejects an empty chat", async () => {
    await expect(
      runAgentChat({
        messages: [],
        settings: DEFAULT_AGENT_SETTINGS,
        catalog: [],
        draft: null,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
