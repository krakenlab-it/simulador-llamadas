import { deepSeek } from "@ai-sdk/deepseek";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { gateway, type LanguageModel } from "ai";
import type { AgentResolvedProvider } from "./types";
import {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_GATEWAY_DEEPSEEK_MODEL,
  FALLBACK_GEMINI_MODEL,
  FALLBACK_GROQ_MODEL,
} from "./models";

export {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_GATEWAY_DEEPSEEK_MODEL,
  FALLBACK_GEMINI_MODEL,
  FALLBACK_GROQ_MODEL,
} from "./models";

export function createAgentModel(
  provider: AgentResolvedProvider,
): LanguageModel | null {
  switch (provider) {
    case "gateway":
      return gateway(DEFAULT_GATEWAY_DEEPSEEK_MODEL);
    case "deepseek":
      return deepSeek(DEFAULT_DEEPSEEK_MODEL);
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
