import { deepSeek } from "@ai-sdk/deepseek";
import { createGateway } from "@ai-sdk/gateway";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import type { AgentResolvedProvider } from "./types";
import {
  DEFAULT_DEEPSEEK_MODEL,
  FALLBACK_GEMINI_MODEL,
  FALLBACK_GROQ_MODEL,
} from "./models";

export {
  DEFAULT_DEEPSEEK_MODEL,
  FALLBACK_GEMINI_MODEL,
  FALLBACK_GROQ_MODEL,
} from "./models";

function hasEnvKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function createAgentModel(
  provider: AgentResolvedProvider,
): LanguageModel | null {
  switch (provider) {
    case "deepseek":
      if (hasEnvKey("DEEPSEEK_API_KEY")) {
        return deepSeek(DEFAULT_DEEPSEEK_MODEL);
      }
      if (hasEnvKey("AI_GATEWAY_API_KEY")) {
        const gateway = createGateway({
          apiKey: process.env.AI_GATEWAY_API_KEY,
        });
        return gateway(`deepseek/${DEFAULT_DEEPSEEK_MODEL}`);
      }
      return null;
    case "groq":
      return groq(FALLBACK_GROQ_MODEL);
    case "gemini":
      return google(FALLBACK_GEMINI_MODEL);
    case "local":
      return null;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
