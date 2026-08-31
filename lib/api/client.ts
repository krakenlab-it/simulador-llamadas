import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import {
  stubCreateSession,
  stubEndSession,
  stubGetTurnSummaries,
  stubSubmitTurn,
  type CreateSessionRequest,
  type EndSessionResponse,
  type SessionResponse,
  type TurnRequest,
  type TurnResponse,
  type TurnSummary,
} from "@/lib/api/stubs";

/**
 * API client — calls App Router routes (#5 contract), stubs on fetch failure.
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

export async function getSessionTurnSummaries(
  callAttemptId: string,
): Promise<TurnSummary[]> {
  return stubGetTurnSummaries(callAttemptId);
}

export type {
  CreateSessionRequest,
  EndSessionResponse,
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
