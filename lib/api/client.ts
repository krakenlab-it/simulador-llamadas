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
      throw new Error(await readErrorMessage(res));
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

export async function listScenarios(): Promise<ScenarioRecord[]> {
  const remote = await tryFetch<{ scenarios: ScenarioRecord[] }>("/api/scenarios");
  return remote?.scenarios ?? stubListScenarios();
}

export type CreateScenarioRequest = CreateCustomScenarioInput;
export type UpdateScenarioRequest = UpdateCustomScenarioInput;

export async function createScenario(
  body: CreateScenarioRequest,
): Promise<ScenarioRecord> {
  const remote = await tryFetch<ScenarioRecord>("/api/scenarios", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return remote ?? stubCreateScenario(body);
}

export async function saveScenarioVoiceAgent(
  slug: string,
  voiceAgent: VoiceAgentSettings,
): Promise<ScenarioRecord> {
  const remote = await tryFetch<ScenarioRecord>("/api/scenarios/voice-agent", {
    method: "PATCH",
    body: JSON.stringify({ slug, voiceAgent }),
  });
  return remote ?? stubSaveVoiceAgent(slug, voiceAgent);
}

export async function updateScenario(
  body: UpdateScenarioRequest,
): Promise<ScenarioRecord> {
  const remote = await tryFetch<ScenarioRecord>(`/api/scenarios/${body.slug}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return remote ?? stubUpdateScenario(body);
}

export async function listHistory(query: {
  traineeId?: string | null;
  email?: string | null;
  scenarioSlug?: string;
}): Promise<HistoryEntry[]> {
  const params = new URLSearchParams();
  if (query.traineeId) params.set("traineeId", query.traineeId);
  if (query.email) params.set("email", query.email);
  if (query.scenarioSlug) params.set("scenarioSlug", query.scenarioSlug);

  const remote = await tryFetch<{ history: HistoryEntry[] }>(
    `/api/history?${params.toString()}`,
  );
  if (remote) return remote.history;
  return stubListHistory(query.traineeId ?? undefined, query.email ?? undefined);
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
