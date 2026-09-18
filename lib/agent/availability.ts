import type {
  AgentProviderAvailability,
  AgentProviderPreference,
  AgentResolvedProvider,
  AgentResolvedRuntime,
  AgentRuntimeMode,
} from "./types";

export const AGENT_ENV_NAMES = [
  "DEEPSEEK_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

function hasKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function readProviderAvailability(): AgentProviderAvailability {
  const deepseek = hasKey("DEEPSEEK_API_KEY");
  const groq = hasKey("GROQ_API_KEY");
  const gemini = hasKey("GOOGLE_API_KEY");
  const gateway = hasKey("AI_GATEWAY_API_KEY");
  return {
    deepseek,
    groq,
    gemini,
    gateway,
    hasModel: deepseek || groq || gemini || gateway,
  };
}

export function isDeepSeekAvailable(): boolean {
  return hasKey("DEEPSEEK_API_KEY") || hasKey("AI_GATEWAY_API_KEY");
}

export function resolveAgentProvider(
  preference: AgentProviderPreference,
  availability: AgentProviderAvailability = readProviderAvailability(),
): AgentResolvedProvider {
  const pick = (wanted: AgentResolvedProvider): AgentResolvedProvider => {
    switch (wanted) {
      case "deepseek":
        return availability.deepseek || availability.gateway ? "deepseek" : "local";
      case "groq":
        return availability.groq ? "groq" : "local";
      case "gemini":
        return availability.gemini ? "gemini" : "local";
      case "local":
        return "local";
      default: {
        const _exhaustive: never = wanted;
        return _exhaustive;
      }
    }
  };

  switch (preference) {
    case "deepseek":
    case "groq":
    case "gemini":
      return pick(preference);
    case "auto":
      if (availability.deepseek || availability.gateway) return "deepseek";
      if (availability.groq) return "groq";
      if (availability.gemini) return "gemini";
      return "local";
    default: {
      const _exhaustive: never = preference;
      return _exhaustive;
    }
  }
}

export function resolveAgentRuntime(
  runtime: AgentRuntimeMode,
  availability: AgentProviderAvailability = readProviderAvailability(),
  preference: AgentProviderPreference = "auto",
): { runtime: AgentResolvedRuntime; provider: AgentResolvedProvider } {
  if (runtime === "local") {
    return { runtime: "local", provider: "local" };
  }

  const provider = resolveAgentProvider(preference, availability);
  const canUseSdk = provider !== "local";

  if (runtime === "ai-sdk") {
    return canUseSdk
      ? { runtime: "ai-sdk", provider }
      : { runtime: "ai-sdk", provider: "local" };
  }

  return canUseSdk
    ? { runtime: "ai-sdk", provider }
    : { runtime: "local", provider: "local" };
}
