import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_ENV_NAMES,
  readProviderAvailability,
  resolveAgentProvider,
  resolveAgentRuntime,
} from "@/lib/agent";

const KEYS = [
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "DEEPSEEK_API_KEY",
] as const;

const saved = Object.fromEntries(
  KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function clearKeys() {
  for (const key of KEYS) delete process.env[key];
}

describe("agent availability", () => {
  it("resolves local when no keys exist and never leaks secrets", () => {
    clearKeys();
    const availability = readProviderAvailability();
    expect(availability.hasModel).toBe(false);
    expect(resolveAgentProvider("auto", availability)).toBe("local");
    expect(resolveAgentRuntime("auto", availability).runtime).toBe("local");
    expect(JSON.stringify(availability)).not.toMatch(/sk-|gsk-/);
    expect(AGENT_ENV_NAMES[0]).toBe("AI_GATEWAY_API_KEY");
    expect(AGENT_ENV_NAMES).toContain("VERCEL_OIDC_TOKEN");
    expect(AGENT_ENV_NAMES.at(-1)).toBe("DEEPSEEK_API_KEY");
  });

  it("defaults auto to Gateway → DeepSeek when the gateway key is present", () => {
    clearKeys();
    process.env.AI_GATEWAY_API_KEY = "gw-test";
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.DEEPSEEK_API_KEY = "ds-test";
    const availability = readProviderAvailability();
    expect(availability.gateway).toBe(true);
    expect(resolveAgentProvider("auto", availability)).toBe("gateway");
    expect(resolveAgentRuntime("auto", availability).provider).toBe("gateway");
    expect(resolveAgentProvider("deepseek", availability)).toBe("gateway");
  });

  it("treats VERCEL_OIDC_TOKEN as gateway auth", () => {
    clearKeys();
    process.env.VERCEL_OIDC_TOKEN = "oidc-test";
    const availability = readProviderAvailability();
    expect(availability.gateway).toBe(true);
    expect(resolveAgentProvider("auto", availability)).toBe("gateway");
  });

  it("uses a direct DeepSeek key only as last-resort fallback", () => {
    clearKeys();
    process.env.DEEPSEEK_API_KEY = "ds-test";
    process.env.GROQ_API_KEY = "gsk-test";
    const withGroq = readProviderAvailability();
    expect(resolveAgentProvider("auto", withGroq)).toBe("groq");

    delete process.env.GROQ_API_KEY;
    const lastResort = readProviderAvailability();
    expect(lastResort.deepseek).toBe(true);
    expect(resolveAgentProvider("auto", lastResort)).toBe("deepseek");
  });
});
