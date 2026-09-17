import type {
  KrakenLabCohortConfig,
  SaveCohortResult,
  StartKrakenSessionResult,
} from "@/lib/kraken-lab/types";
import type { AgenticRuntimeConfig } from "@/lib/agentic/types";
import { stubStartKrakenSession } from "@/lib/api/stubs";

const GENERIC_ERROR = "No se pudo completar la acción. Intenta de nuevo.";

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return GENERIC_ERROR;
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

async function tryFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (res.status === 404 || res.status === 405) return null;
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

/**
 * Kraken Lab session start: fall back to the in-memory stub when the API is
 * missing or the preview DB is not migrated (5xx). Validation errors (4xx)
 * still surface to the wizard.
 */
async function fetchKrakenSessionStart(
  body: StartKrakenSessionRequest,
): Promise<StartKrakenSessionResult | null> {
  try {
    const res = await fetch("/api/kraken-lab/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 404 || res.status === 405) return null;
    if (res.status >= 500) return null;

    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }

    return (await res.json()) as StartKrakenSessionResult;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export async function saveKrakenCohort(
  config: KrakenLabCohortConfig,
): Promise<SaveCohortResult | null> {
  return tryFetch<SaveCohortResult>("/api/kraken-lab/cohorts", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function getKrakenCohort(
  cohortId: string,
): Promise<KrakenLabCohortConfig | null> {
  return tryFetch<KrakenLabCohortConfig>(`/api/kraken-lab/cohorts/${cohortId}`);
}

export interface StartKrakenSessionRequest {
  cohort: KrakenLabCohortConfig;
  mode: "voz" | "texto";
  traineeId?: string;
  traineeEmail?: string;
  traineeAuthUserId?: string;
  traineeDisplayName?: string;
  agenticRuntime?: AgenticRuntimeConfig;
}

export async function startKrakenSession(
  body: StartKrakenSessionRequest,
): Promise<StartKrakenSessionResult> {
  const remote = await fetchKrakenSessionStart(body);
  return remote ?? stubStartKrakenSession(body);
}
