import type { Client } from "pg";
import type { DifficultyLevel } from "@/lib/db/types";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { scoreTurnAdaptive } from "@/lib/scoring/adaptive";
import {
  SessionRepository,
  type CreateSessionInput,
  type EndSessionResult,
  type HistoryEntry,
  type SessionRecord,
  type TurnRecord,
} from "./repository";

export interface SubmitTurnInput {
  callAttemptId: string;
  utterance: string;
}

export class SessionService {
  private readonly repository: SessionRepository;

  constructor(client: Client) {
    this.repository = new SessionRepository(client);
  }

  async startSession(input: CreateSessionInput): Promise<SessionRecord> {
    return this.repository.createSession(input);
  }

  async submitTurn(input: SubmitTurnInput): Promise<TurnRecord> {
    const session = await this.repository.getSession(input.callAttemptId);

    if (!session) throw new Error("Session not found");
    if (session.status !== "in_progress") throw new Error("Session is not in progress");
    if (session.currentRound > session.totalRounds) {
      throw new Error("All rounds already completed");
    }

    const trimmed = input.utterance.trim();
    if (!trimmed) throw new Error("Utterance cannot be empty");

    const roundDef = this.repository.getRoundDef(session, session.currentRound);
    const isLastRound = session.currentRound === session.totalRounds;

    const score = await scoreTurnAdaptive({
      utterance: trimmed,
      roundKey: roundDef.key,
      roundLabel: roundDef.label,
      roundGoal:
        roundDef.goal ||
        (roundDef.roundType ? ROUND_EXPECTED[roundDef.roundType] : ""),
      difficultyLevel: session.difficultyLevel,
      scenarioSlug: session.scenarioSlug,
      isPreset: session.isPreset,
      config: session.config,
      clientName: session.clientName,
      isLastRound,
    });

    return this.repository.saveTurn(
      input.callAttemptId,
      session.currentRound,
      trimmed,
      {
        roundType: roundDef.roundType,
        roundKey: roundDef.key,
        roundLabel: roundDef.label,
        roundScore: score.roundScore,
        keywordHits: score.keywordHits,
        clientReaction: score.clientReaction,
        clientReply: score.clientReply,
        feedback: score.feedback,
        richFeedback: score.richFeedback,
        hasConcreteDayAndTime: score.hasConcreteDayAndTime,
        won: score.won,
      },
    );
  }

  async endSession(callAttemptId: string): Promise<EndSessionResult> {
    const session = await this.repository.getSession(callAttemptId);
    if (!session) throw new Error("Session not found");
    return this.repository.endSession(callAttemptId);
  }

  async getSession(callAttemptId: string): Promise<SessionRecord | null> {
    return this.repository.getSession(callAttemptId);
  }

  async listHistory(
    traineeId: string,
    scenarioSlug?: string,
  ): Promise<HistoryEntry[]> {
    return this.repository.listHistoryForTrainee(traineeId, scenarioSlug);
  }
}

export async function createTrainee(
  client: Client,
  displayName: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    "INSERT INTO trainees (display_name) VALUES ($1) RETURNING id",
    [displayName],
  );
  return result.rows[0].id;
}

export function evaluateCloseWinFromScore(
  difficultyLevel: DifficultyLevel,
  hasDay: boolean,
  hasTime: boolean,
  hasReunion: boolean,
  hasDiaHoraKeyword: boolean,
): boolean {
  if (difficultyLevel === 1) {
    return hasReunion && (hasDay || hasDiaHoraKeyword);
  }
  return hasReunion && hasDay && hasTime;
}
