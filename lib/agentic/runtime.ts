import type { ScenarioConfig } from "@/lib/scenarios/types";
import { isClinicPreset } from "@/lib/scenarios/types";
import type { AgenticRuntimeConfig } from "./types";

export function mergeAgenticRuntime(
  config: ScenarioConfig,
  runtime: AgenticRuntimeConfig | undefined,
): ScenarioConfig {
  if (!runtime) return config;
  const preservedContext = config.agentic?.scenarioContextText;
  return {
    ...config,
    agentic: {
      ...config.agentic,
      ...runtime,
      scenarioContextText:
        runtime.scenarioContextText?.trim() || preservedContext,
    },
  };
}

export function isAgenticSessionActive(
  config: ScenarioConfig | null,
  isPreset: boolean,
  scenarioSlug: string,
): boolean {
  if (isPreset && isClinicPreset(scenarioSlug)) return false;
  if (!config) return false;
  return config.agentic?.enabled === true;
}

export function resolveAgenticSeed(
  config: ScenarioConfig,
  scenarioSlug: string,
): string {
  return (
    config.agentic?.sessionSeed ??
    config.krakenLab?.sessionSeed ??
    scenarioSlug
  );
}
