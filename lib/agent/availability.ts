import type {
  AgentProviderAvailability,
  AgentProviderPreference,
  AgentResolvedProvider,
  AgentResolvedRuntime,
  AgentRuntimeMode,
} from "./types";

export const AGENT_ENV_NAMES = [
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

export function readProviderAvailability(): AgentProviderAvailability {
  return {
    groq: Boolean(process.env.GROQ_API_KEY?.trim()),
    gemini: Boolean(process.env.GOOGLE_API_KEY?.trim()),
    gateway: Boolean(process.env.AI_GATEWAY_API_KEY?.trim()),
  };
}

export function resolveAgentRuntime(
  runtime: AgentRuntimeMode,
  availability: AgentProviderAvailability = readProviderAvailability(),
): AgentResolvedRuntime {
  const hasModel = availability.groq || availability.gemini || availability.gateway;
  switch (runtime) {
    case "local":
      return "local";
    case "ai-sdk":
      return "ai-sdk";
    case "auto":
      return hasModel ? "ai-sdk" : "local";
    default: {
      const _exhaustive: never = runtime;
      return _exhaustive;
    }
  }
}

export function resolveAgentProvider(
  preference: AgentProviderPreference,
  availability: AgentProviderAvailability = readProviderAvailability(),
): AgentResolvedProvider {
  switch (preference) {
    case "groq":
      return availability.groq ? "groq" : availability.gemini ? "gemini" : "local";
    case "gemini":
      return availability.gemini ? "gemini" : availability.groq ? "groq" : "local";
    case "auto":
      if (availability.groq) return "groq";
      if (availability.gemini) return "gemini";
      if (availability.gateway) return "groq";
      return "local";
    default: {
      const _exhaustive: never = preference;
      return _exhaustive;
    }
  }
}
