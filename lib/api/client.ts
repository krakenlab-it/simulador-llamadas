import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import type {
  RichTurnFeedback,
  ScenarioRecord,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";
import {
  stubCreateSession,
  stubCreateScenario,
  stubEndSession,
  stubListHistory,
  stubListScenarios,
  stubSubmitTurn,
  type CreateSessionRequest,
  type EndSessionResponse,
  type HistoryEntry,
  type SessionResponse,
  type TurnRequest,
  type TurnResponse,
  type TurnSummary,
} from "@/lib/api/stubs";
import {
  getStoredTraineeId,
  storeTraineeId,
} from "@/lib/trainee/storage";

/**
 * API client — calls App Router routes, stubs on fetch failure.
 */

async function tryFetch<T>(
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
    if (res.status === 404 || res.status === 405 || res.status >= 500) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

function withTraineeId(body: CreateSessionRequest): CreateSessionRequest {
  const traineeId = body.traineeId ?? getStoredTraineeId() ?? undefined;
  return traineeId ? { ...body, traineeId } : body;
}

function rememberTrainee(session: SessionResponse): SessionResponse {
  storeTraineeId(session.traineeId);
  return session;
}

export async function createSession(
  body: CreateSessionRequest,
): Promise<SessionResponse> {
  const payload = withTraineeId(body);
  const remote = await tryFetch<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const session = remote ?? stubCreateSession(payload);
  return rememberTrainee(session);
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
  );
  return remote ?? (await stubSubmitTurn(callAttemptId, body));
}

export async function endSession(
  callAttemptId: string,
): Promise<EndSessionResponse> {
  const remote = await tryFetch<EndSessionResponse>(
    `/api/sessions/${callAttemptId}/end`,
    { method: "POST" },
  );
  return remote ?? stubEndSession(callAttemptId);
}

export async function fetchHistory(
  traineeId?: string,
): Promise<HistoryEntry[]> {
  const id = traineeId ?? getStoredTraineeId();
  if (!id) {
    return [];
  }

  const remote = await tryFetch<{ history: HistoryEntry[] }>(
    `/api/history?traineeId=${encodeURIComponent(id)}`,
  );
  return remote?.history ?? stubListHistory(id);
}

export async function listScenarios(): Promise<ScenarioRecord[]> {
  const remote = await tryFetch<{ scenarios: ScenarioRecord[] }>("/api/scenarios");
  return remote?.scenarios ?? stubListScenarios();
}

export interface CreateScenarioRequest {
  industry: string;
  productSold: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  temperament: string;
  difficultyLabel: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
  traineeId?: string;
}

export async function createScenario(
  body: CreateScenarioRequest,
): Promise<ScenarioRecord> {
  const payload = {
    ...body,
    traineeId: body.traineeId ?? getStoredTraineeId() ?? undefined,
  };
  const remote = await tryFetch<ScenarioRecord>("/api/scenarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return remote ?? stubCreateScenario(payload);
}

export interface HistoryTrend {
  attempts: number;
  scores: (number | null)[];
  averageScore: number;
  improving: boolean;
}

export async function fetchHistoryWithTrend(
  traineeId: string,
  scenarioSlug?: string,
): Promise<{ history: HistoryEntry[]; trend: HistoryTrend | null }> {
  const params = new URLSearchParams({ traineeId });
  if (scenarioSlug) params.set("scenarioSlug", scenarioSlug);
  const remote = await tryFetch<{ history: HistoryEntry[]; trend: HistoryTrend | null }>(
    `/api/history?${params.toString()}`,
  );
  if (remote) return remote;
  const history = stubListHistory(traineeId);
  return { history, trend: null };
}

export type {
  CreateSessionRequest,
  EndSessionResponse,
  HistoryEntry,
  RichTurnFeedback,
  ScenarioRecord,
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

export { getStoredTraineeId, storeTraineeId };
