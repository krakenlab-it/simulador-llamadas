/**
 * Client-side overlay when DB migration is not applied yet.
 * Merged after listScenarios; PATCH library also writes here.
 */

import type { ScenarioRecord } from "@/lib/scenarios/types";

const STORAGE_KEY = "simulador.scenarioLibraryPublished";

function resolveStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readLocalLibraryPublishedSlugs(): Set<string> {
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

export function writeLocalLibraryPublishedSlugs(slugs: Iterable<string>): void {
  const store = resolveStorage();
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify([...slugs]));
}

export function setLocalScenarioLibraryPublished(
  slug: string,
  published: boolean,
): void {
  const slugs = readLocalLibraryPublishedSlugs();
  if (published) {
    slugs.add(slug);
  } else {
    slugs.delete(slug);
  }
  writeLocalLibraryPublishedSlugs(slugs);
}

export function mergeLocalScenarioLibrary(
  scenarios: ScenarioRecord[],
): ScenarioRecord[] {
  const local = readLocalLibraryPublishedSlugs();
  if (local.size === 0) return scenarios;
  const now = new Date().toISOString();
  return scenarios.map((s) => {
    if (s.libraryPublishedAt) return s;
    if (!local.has(s.slug)) return s;
    return { ...s, libraryPublishedAt: now };
  });
}
