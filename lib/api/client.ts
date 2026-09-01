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
  stubListScenarios,
  stubSubmitTurn,
  type CreateSessionRequest,
  type EndSessionResponse,
  type SessionResponse,
  type TurnRequest,
  type TurnResponse,
  type TurnSummary,
} from "@/lib/api/stubs";

/**
 * API client — no auth. Anyone with the URL can start a call.
 * History for the demo UI is device-local (see lib/history/local.ts).
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
  );
  return remote ?? stubSubmitTurn(callAttemptId, body);
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
}

export async function createScenario(
  body: CreateScenarioRequest,
): Promise<ScenarioRecord> {
  const remote = await tryFetch<ScenarioRecord>("/api/scenarios", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return remote ?? stubCreateScenario(body);
}

export type {
  CreateSessionRequest,
  EndSessionResponse,
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
