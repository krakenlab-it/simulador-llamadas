import { afterEach, describe, expect, it } from "vitest";
import {
  AgentHarnessError,
  DEFAULT_AGENT_SETTINGS,
  runAgentChat,
} from "@/lib/agent";

const KEYS = [
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "DEEPSEEK_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("runAgentChat", () => {
  it("uses local runtime when auto has no keys", async () => {
    for (const key of KEYS) delete process.env[key];
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
    for (const key of KEYS) delete process.env[key];
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
