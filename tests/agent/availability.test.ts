import { afterEach, describe, expect, it } from "vitest";
import {
  readProviderAvailability,
  resolveAgentProvider,
  resolveAgentRuntime,
} from "@/lib/agent/availability";

describe("agent provider availability", () => {
  const saved = {
    groq: process.env.GROQ_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    gateway: process.env.AI_GATEWAY_API_KEY,
  };

  afterEach(() => {
    if (saved.groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = saved.groq;
    if (saved.google === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = saved.google;
    if (saved.gateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = saved.gateway;
  });

  it("treats empty env values as missing and never returns secrets", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    expect(readProviderAvailability()).toEqual({
      groq: false,
      gemini: false,
      gateway: false,
    });
    expect(resolveAgentRuntime("auto")).toBe("local");
    expect(resolveAgentProvider("auto")).toBe("local");
  });

  it("prefers Groq in auto when GROQ_API_KEY is present", () => {
    process.env.GROQ_API_KEY = "not-a-real-key";
    delete process.env.GOOGLE_API_KEY;
    expect(readProviderAvailability().groq).toBe(true);
    expect(resolveAgentRuntime("auto")).toBe("ai-sdk");
    expect(resolveAgentProvider("auto")).toBe("groq");
  });
});
