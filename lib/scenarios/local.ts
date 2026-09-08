/**
 * Device-local custom scenarios for preview/demo when the DB is unavailable.
 */

import type { ScenarioRecord } from "@/lib/scenarios/types";

const LOCAL_CUSTOM_SCENARIOS_KEY = "simulador:localCustomScenarios";

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function isScenarioRecord(value: unknown): value is ScenarioRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as ScenarioRecord;
  return (
    typeof record.slug === "string" &&
    typeof record.clientName === "string" &&
    record.isPreset === false &&
    record.config !== null &&
    typeof record.config === "object"
  );
}

export interface LocalCustomScenariosLoadResult {
  scenarios: ScenarioRecord[];
  error: string | null;
}

export function loadLocalCustomScenariosSafe(): LocalCustomScenariosLoadResult {
  if (!canUseLocalStorage()) {
    return {
      scenarios: [],
      error: "Los escenarios personalizados no están disponibles en este entorno.",
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_SCENARIOS_KEY);
    if (!raw) return { scenarios: [], error: null };
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        scenarios: [],
        error: "Los escenarios guardados están dañados.",
      };
    }
    return {
      scenarios: parsed.filter(isScenarioRecord),
      error: null,
    };
  } catch {
    return {
      scenarios: [],
      error: "No se pudieron leer los escenarios guardados.",
    };
  }
}

export function loadLocalCustomScenarios(): ScenarioRecord[] {
  return loadLocalCustomScenariosSafe().scenarios;
}

export function upsertLocalCustomScenario(record: ScenarioRecord): void {
  if (!canUseLocalStorage() || record.isPreset) return;

  const existing = loadLocalCustomScenarios().filter(
    (scenario) => scenario.slug !== record.slug,
  );
  const next = [record, ...existing].slice(0, 50);
  localStorage.setItem(LOCAL_CUSTOM_SCENARIOS_KEY, JSON.stringify(next));
}

/** Test helper */
export function clearLocalCustomScenarios(): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(LOCAL_CUSTOM_SCENARIOS_KEY);
}
