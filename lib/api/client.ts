import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import type {
  CreateCustomScenarioInput,
  RichTurnFeedback,
  ScenarioRecord,
  SessionEvaluationSummary,
  UpdateCustomScenarioInput,
} from "@/lib/scenarios/types";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";
import {
  completedHistoryEntries,
  localEntryToHistoryEntry,
  mergeHistoryEntries,
} from "@/lib/history/merge";
import { loadLocalHistorySafe } from "@/lib/history/local";
import { loadLocalCustomScenarios } from "@/lib/scenarios/local";
import {
  stubCreateSession,
  stubCreateScenario,
  stubSaveVoiceAgent,
  stubEndSession,
  stubGetSessionDetail,
  stubHasSession,
  stubListHistory,
  stubListScenarios,
  stubSubmitTurn,
  stubUpdateScenario,
  type CreateSessionRequest,
  type EndSessionResponse,
  type HistoryEntry,
  type SessionDetail,
  type SessionResponse,
  type TurnRequest,
  type TurnResponse,
  type TurnSummary,
} from "@/lib/api/stubs";

/**
 * API client — no auth. Anyone with the URL can start a call.
 * History for the demo UI is device-local (see lib/history/local.ts).
 */

const GENERIC_ERROR = "No se pudo completar la acción. Intenta de nuevo.";

/** Database driver text must never reach a toast. */
function looksLikeDriverError(message: string): boolean {
  return /duplicate key|violates .*constraint|syntax error at or near|relation "|column "/i.test(
    message,
  );
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return GENERIC_ERROR;

  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const field = parsed.error ?? parsed.message;
    if (typeof field === "string" && field.trim()) message = field;
  } catch {
    // Non-JSON body: fall through to the sanitizer below.
  }

  return looksLikeDriverError(message) ? GENERIC_ERROR : message;
}

/**
 * Calls the API, returning null when the caller can serve the request from the
 * in-memory demo stub instead. A caller with no usable stub (a real session
 * already created on the server) gets the server error, because silently
 * answering with stub data would drop the trainee into a different simulation.
 */
async function tryFetch<T>(
  url: string,
  init?: RequestInit,
  options: { stubAvailable?: boolean } = {},
): Promise<T | null> {
  const { stubAvailable = true } = options;

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (res.status === 404 || res.status === 405) {
      if (!stubAvailable) throw new Error(await readErrorMessage(res));
      return null;
    }
    if (res.status >= 500) {
      if (!stubAvailable) throw new Error(await readErrorMessage(res));
      return null;
    }
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

export async function createSession(
  body: CreateSessionRequest,
): Promise<SessionResponse> {
  const remote = await tryFetch<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return remote ?? stubCreateSession(body);
}

export async function submitTurn(
  callAttemptId: string,
  body: TurnRequest,
): Promise<TurnResponse> {
  const remote = await tryFetch<TurnResponse>(
    `/api/sessions/${callAttemptId}/turns`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    { stubAvailable: stubHasSession(callAttemptId) },
  );
  return remote ?? (await stubSubmitTurn(callAttemptId, body));
}

export async function endSession(
  callAttemptId: string,
): Promise<EndSessionResponse> {
  const remote = await tryFetch<EndSessionResponse>(
    `/api/sessions/${callAttemptId}/end`,
    { method: "POST" },
    { stubAvailable: stubHasSession(callAttemptId) },
  );
  return remote ?? (await stubEndSession(callAttemptId));
}

/**
 * Read-only catalog bootstrap (scenario list). Falls back to the in-memory stub
 * on 404/405/5xx or network failure so preview/demo stays usable without DB.
 *
 * Also used for authoring writes that have a usable local stub fallback.
 */
async function tryFetchCatalog<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (res.status === 404 || res.status === 405) return null;
    if (res.status >= 500) return null;
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export interface ScenarioCatalogResult {
  scenarios: ScenarioRecord[];
  usedLocalFallback: boolean;
}

function mergeLocalCustomIntoCatalog(
  scenarios: ScenarioRecord[],
): ScenarioRecord[] {
  const slugs = new Set(scenarios.map((scenario) => scenario.slug));
  const localOnly = loadLocalCustomScenarios().filter(
    (scenario) => !scenario.isPreset && !slugs.has(scenario.slug),
  );
  return localOnly.length > 0 ? [...scenarios, ...localOnly] : scenarios;
}

export async function loadScenarioCatalog(): Promise<ScenarioCatalogResult> {
  try {
    const remote = await tryFetchCatalog<{ scenarios: ScenarioRecord[] }>(
      "/api/scenarios",
    );
    if (remote?.scenarios) {
      return {
        scenarios: mergeLocalCustomIntoCatalog(remote.scenarios),
        usedLocalFallback: false,
      };
    }
  } catch {
    // Unexpected 4xx — still serve the local clinic presets for training.
  }
  return {
    scenarios: stubListScenarios(),
    usedLocalFallback: true,
  };
}

export async function listScenarios(): Promise<ScenarioRecord[]> {
  const { scenarios } = await loadScenarioCatalog();
  return scenarios;
}

export type CreateScenarioRequest = CreateCustomScenarioInput;
export type UpdateScenarioRequest = UpdateCustomScenarioInput;

export interface ScenarioWriteResult {
  scenario: ScenarioRecord;
  usedLocalFallback: boolean;
}

export async function createScenario(
  body: CreateScenarioRequest,
): Promise<ScenarioWriteResult> {
  try {
    const remote = await tryFetchCatalog<ScenarioRecord>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (remote) {
      return { scenario: remote, usedLocalFallback: false };
    }
  } catch (error) {
    throw error;
  }
  return { scenario: stubCreateScenario(body), usedLocalFallback: true };
}

export async function saveScenarioVoiceAgent(
  slug: string,
  voiceAgent: VoiceAgentSettings,
): Promise<ScenarioWriteResult> {
  try {
    const remote = await tryFetchCatalog<ScenarioRecord>("/api/scenarios/voice-agent", {
      method: "PATCH",
      body: JSON.stringify({ slug, voiceAgent }),
    });
    if (remote) {
      return { scenario: remote, usedLocalFallback: false };
    }
  } catch (error) {
    throw error;
  }
  return {
    scenario: stubSaveVoiceAgent(slug, voiceAgent),
    usedLocalFallback: true,
  };
}

export async function updateScenario(
  body: UpdateScenarioRequest,
): Promise<ScenarioWriteResult> {
  try {
    const remote = await tryFetchCatalog<ScenarioRecord>(`/api/scenarios/${body.slug}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (remote) {
      return { scenario: remote, usedLocalFallback: false };
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return { scenario: stubUpdateScenario(body), usedLocalFallback: true };
    }
    throw error;
  }
  return { scenario: stubUpdateScenario(body), usedLocalFallback: true };
}

/**
 * Read-only history bootstrap. Falls back to device-local history (and stub
 * history when available) on 404/405/5xx or network failure.
 */
async function tryFetchHistory<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 404 || res.status === 405) return null;
    if (res.status >= 500) return null;
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export interface HistoryLoadResult {
  entries: HistoryEntry[];
  usedLocalFallback: boolean;
  localReadError: string | null;
}

export async function loadHistory(query: {
  traineeId?: string | null;
  email?: string | null;
  scenarioSlug?: string;
}): Promise<HistoryLoadResult> {
  const localLoad = loadLocalHistorySafe();
  const localEntries = localLoad.entries.map(localEntryToHistoryEntry);
  const hasServerIdentity = Boolean(query.traineeId || query.email?.trim());

  if (!hasServerIdentity) {
    return {
      entries: localEntries,
      usedLocalFallback: true,
      localReadError: localLoad.error,
    };
  }

  const params = new URLSearchParams();
  if (query.traineeId) params.set("traineeId", query.traineeId);
  if (query.email) params.set("email", query.email);
  if (query.scenarioSlug) params.set("scenarioSlug", query.scenarioSlug);

  try {
    const remote = await tryFetchHistory<{ history: HistoryEntry[] }>(
      `/api/history?${params.toString()}`,
    );

    if (remote) {
      return {
        entries: mergeHistoryEntries(
          completedHistoryEntries(remote.history),
          localEntries,
        ),
        usedLocalFallback: false,
        localReadError: localLoad.error,
      };
    }
  } catch {
    // Unexpected 4xx — fall through to local/stub fallback.
  }

  const stubEntries = stubListHistory(
    query.traineeId ?? undefined,
    query.email ?? undefined,
  );

  return {
    entries: mergeHistoryEntries(localEntries, completedHistoryEntries(stubEntries)),
    usedLocalFallback: true,
    localReadError: localLoad.error,
  };
}

export async function listHistory(query: {
  traineeId?: string | null;
  email?: string | null;
  scenarioSlug?: string;
}): Promise<HistoryEntry[]> {
  const { entries } = await loadHistory(query);
  return entries;
}

export async function getSessionDetail(
  callAttemptId: string,
): Promise<SessionDetail> {
  const remote = await tryFetch<SessionDetail>(
    `/api/sessions/${callAttemptId}`,
    undefined,
    { stubAvailable: stubHasSession(callAttemptId) },
  );
  return remote ?? stubGetSessionDetail(callAttemptId);
}

export type {
  CreateSessionRequest,
  EndSessionResponse,
  HistoryEntry,
  RichTurnFeedback,
  ScenarioRecord,
  SessionDetail,
  SessionEvaluationSummary,
  SessionResponse,
  TurnRequest,
  TurnResponse,
  TurnSummary,
};

export type SessionConfig = {
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
};
