import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import type { AgentResolvedProvider } from "./types";

export function createAgentModel(
  provider: AgentResolvedProvider,
): LanguageModel | null {
  switch (provider) {
    case "groq":
      return groq("llama-3.1-8b-instant");
    case "gemini":
      return google("gemini-2.0-flash");
    case "local":
      return null;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
