/**
 * Client-side overlay when DB migration is not applied yet.
 * Merged after listScenarios; PATCH lifecycle also writes here.
 */

import type { ScenarioRecord } from "@/lib/scenarios/types";

const STORAGE_KEY = "simulador.scenarioDeactivated";

function resolveStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readLocalDeactivatedSlugs(): Set<string> {
  const store = resolveStorage();
  if (!store) return new Set();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function writeLocalDeactivatedSlugs(slugs: Iterable<string>): void {
  const store = resolveStorage();
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify([...slugs]));
}

export function setLocalScenarioActive(slug: string, active: boolean): void {
  const slugs = readLocalDeactivatedSlugs();
  if (active) {
    slugs.delete(slug);
  } else {
    slugs.add(slug);
  }
  writeLocalDeactivatedSlugs(slugs);
}

export function mergeLocalScenarioLifecycle(
  scenarios: ScenarioRecord[],
): ScenarioRecord[] {
  const local = readLocalDeactivatedSlugs();
  if (local.size === 0) return scenarios;
  const now = new Date().toISOString();
  return scenarios.map((s) => {
    if (s.deactivatedAt) return s;
    if (!local.has(s.slug)) return s;
    return { ...s, deactivatedAt: now };
  });
}
