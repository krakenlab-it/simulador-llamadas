import type {
  CallStatus,
  DifficultyLevel,
  PracticeMode,
  RoundType,
  ScoringKeyword,
} from "@/lib/db/types";
import { ROUND_ORDER } from "@/lib/db/types";
import { getClientBySlug } from "@/lib/clients";
import { scoreTurn } from "@/lib/scoring";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import type { ClientReaction } from "@/lib/scoring/rondas";

/**
 * Thin offline fallback when App Router routes are unavailable.
 * Mirrors the #5 API contract; scoring delegates to lib/scoring.
 */

export interface CreateSessionRequest {
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  traineeId?: string;
  traineeDisplayName?: string;
}

export interface HistoryEntry {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  clientName: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  won: boolean | null;
  totalScore: number | null;
  startedAt: string;
  endedAt: string | null;
  turnsCompleted: number;
}

export interface SessionResponse {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  status: CallStatus;
  currentRound: number;
}

export interface TurnRequest {
  utterance: string;
}

export interface TurnResponse {
  turnId: string;
  roundNumber: number;
  roundType: RoundType;
  traineeUtterance: string;
  roundScore: number;
  keywordHits: Partial<Record<ScoringKeyword, boolean>>;
  clientReaction: ClientReaction;
  clientReply: string;
  feedback: string;
  hasConcreteDayAndTime: boolean;
  won: boolean;
}

export interface TurnSummary {
  roundType: RoundType;
  utterance: string;
  expectedPhrase: string;
  roundScore: number;
}

export interface EndSessionResponse {
  callAttemptId: string;
  status: CallStatus;
  won: boolean;
  totalScore: number;
  turnsCompleted: number;
}

interface StubSession {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  currentRound: number;
  status: CallStatus;
  turns: TurnSummary[];
  won: boolean;
  startedAt: string;
}

const sessions = new Map<string, StubSession>();
const historyByTrainee = new Map<string, HistoryEntry[]>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function stubCreateSession(body: CreateSessionRequest): SessionResponse {
  const client = getClientBySlug(body.scenarioSlug);
  if (!client) {
    throw new Error(`Cliente no encontrado: ${body.scenarioSlug}`);
  }

  const callAttemptId = generateId("stub");
  const traineeId = body.traineeId ?? generateId("trainee");
  const session: StubSession = {
    callAttemptId,
    traineeId,
    scenarioSlug: body.scenarioSlug,
    mode: body.mode,
    difficultyLevel: body.difficultyLevel,
    currentRound: 1,
    status: "in_progress",
    turns: [],
    won: false,
    startedAt: new Date().toISOString(),
  };
  sessions.set(callAttemptId, session);

  return {
    callAttemptId,
    traineeId: session.traineeId,
    scenarioSlug: body.scenarioSlug,
    mode: body.mode,
    difficultyLevel: body.difficultyLevel,
    status: "in_progress",
    currentRound: 1,
  };
}

export function stubSubmitTurn(
  callAttemptId: string,
  body: TurnRequest,
): TurnResponse {
  const session = sessions.get(callAttemptId);
  if (!session) {
    throw new Error("Sesión no encontrada");
  }
  if (session.status !== "in_progress") {
    throw new Error("La sesión ya terminó");
  }
  if (session.currentRound > 5) {
    throw new Error("All rounds already completed");
  }

  const roundNumber = session.currentRound;
  const roundType = ROUND_ORDER[roundNumber - 1];
  if (!roundType) {
    throw new Error("Número de ronda inválido");
  }

  const trimmed = body.utterance.trim();
  if (!trimmed) {
    throw new Error("Utterance cannot be empty");
  }

  const score = scoreTurn({
    utterance: trimmed,
    roundType,
    difficultyLevel: session.difficultyLevel,
    scenarioSlug: session.scenarioSlug,
  });

  session.turns.push({
    roundType,
    utterance: trimmed,
    expectedPhrase: ROUND_EXPECTED[roundType],
    roundScore: score.roundScore,
  });
  session.currentRound = roundNumber + 1;
  if (roundType === "cierre") {
    session.won = score.won;
  }

  return {
    turnId: generateId("turn"),
    roundNumber,
    roundType,
    traineeUtterance: trimmed,
    roundScore: score.roundScore,
    keywordHits: score.keywordHits,
    clientReaction: score.clientReaction,
    clientReply: score.clientReply,
    feedback: score.feedback,
    hasConcreteDayAndTime: score.hasConcreteDayAndTime,
    won: score.won,
  };
}

export function stubEndSession(callAttemptId: string): EndSessionResponse {
  const session = sessions.get(callAttemptId);
  if (!session) {
    throw new Error("Sesión no encontrada");
  }

  session.status = "completed";

  const totalScore =
    session.turns.length > 0
      ? Math.round(
          (session.turns.reduce((sum, t) => sum + t.roundScore, 0) /
            session.turns.length) *
            100,
        ) / 100
      : 0;

  const cierre = session.turns.find((t) => t.roundType === "cierre");
  const won = Boolean(cierre && session.won);
  const endedAt = new Date().toISOString();
  const persona = getClientBySlug(session.scenarioSlug);

  const entry: HistoryEntry = {
    callAttemptId,
    traineeId: session.traineeId,
    scenarioSlug: session.scenarioSlug,
    clientName: persona?.name ?? session.scenarioSlug,
    difficultyLevel: session.difficultyLevel,
    mode: session.mode,
    status: "completed",
    won,
    totalScore,
    startedAt: session.startedAt,
    endedAt,
    turnsCompleted: session.turns.length,
  };

  const existing = historyByTrainee.get(session.traineeId) ?? [];
  historyByTrainee.set(session.traineeId, [entry, ...existing].slice(0, 50));

  return {
    callAttemptId,
    status: "completed",
    won,
    totalScore,
    turnsCompleted: session.turns.length,
  };
}

export function stubListHistory(traineeId: string): HistoryEntry[] {
  return [...(historyByTrainee.get(traineeId) ?? [])];
}

export function stubGetTurnSummaries(callAttemptId: string): TurnSummary[] {
  return [...(sessions.get(callAttemptId)?.turns ?? [])];
}

/** Reset in-memory store (tests only) */
export function resetStubSessions(): void {
  sessions.clear();
  historyByTrainee.clear();
}
