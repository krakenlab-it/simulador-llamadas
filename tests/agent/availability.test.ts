import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_ENV_NAMES,
  readProviderAvailability,
  resolveAgentProvider,
  resolveAgentRuntime,
} from "@/lib/agent";

const KEYS = [
  "DEEPSEEK_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "AI_GATEWAY_API_KEY",
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

describe("agent availability", () => {
  it("resolves local when no keys exist and never leaks secrets", () => {
    for (const key of KEYS) delete process.env[key];
    const availability = readProviderAvailability();
    expect(availability.hasModel).toBe(false);
    expect(resolveAgentProvider("auto", availability)).toBe("local");
    expect(resolveAgentRuntime("auto", availability).runtime).toBe("local");
    expect(JSON.stringify(availability)).not.toMatch(/sk-|gsk-/);
    expect(AGENT_ENV_NAMES).toContain("DEEPSEEK_API_KEY");
  });

  it("defaults auto to DeepSeek when that key is present", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.DEEPSEEK_API_KEY = "ds-test";
    process.env.GROQ_API_KEY = "gsk-test";
    const availability = readProviderAvailability();
    expect(availability.deepseek).toBe(true);
    expect(resolveAgentProvider("auto", availability)).toBe("deepseek");
    expect(resolveAgentRuntime("auto", availability).provider).toBe("deepseek");
  });
});
