import type { Client } from "pg";
import type {
  CallStatus,
  DifficultyLevel,
  PracticeMode,
  RoundType,
  ScoringKeyword,
} from "@/lib/db/types";
import { getRoundTypeForNumber } from "@/lib/extension-points/session";
import type { ClientReaction } from "@/lib/scoring/rondas";
import { evaluateCloseWinFromScore } from "./service";

export interface CreateSessionInput {
  traineeId: string;
  scenarioSlug: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
}

export interface SessionRecord {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  currentRound: number;
}

export interface TurnRecord {
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

export interface EndSessionResult {
  callAttemptId: string;
  status: CallStatus;
  won: boolean;
  totalScore: number;
  turnsCompleted: number;
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

export class SessionRepository {
  constructor(private readonly client: Client) {}

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const scenario = await this.client.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM scenarios WHERE slug = $1",
      [input.scenarioSlug],
    );

    if (scenario.rows.length === 0) {
      throw new Error(`Unknown scenario slug: ${input.scenarioSlug}`);
    }

    const attempt = await this.client.query<{ id: string }>(
      `INSERT INTO call_attempts (trainee_id, scenario_id, difficulty_level, mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        input.traineeId,
        scenario.rows[0].id,
        input.difficultyLevel,
        input.mode,
      ],
    );

    return {
      callAttemptId: attempt.rows[0].id,
      traineeId: input.traineeId,
      scenarioSlug: scenario.rows[0].slug,
      difficultyLevel: input.difficultyLevel,
      mode: input.mode,
      status: "in_progress",
      currentRound: 1,
    };
  }

  async getSession(callAttemptId: string): Promise<SessionRecord | null> {
    const result = await this.client.query<{
      id: string;
      trainee_id: string;
      scenario_slug: string;
      difficulty_level: DifficultyLevel;
      mode: PracticeMode;
      status: CallStatus;
      turns_completed: string;
    }>(
      `SELECT
         ca.id,
         ca.trainee_id,
         s.slug AS scenario_slug,
         ca.difficulty_level,
         ca.mode,
         ca.status,
         COUNT(ct.id)::text AS turns_completed
       FROM call_attempts ca
       JOIN scenarios s ON s.id = ca.scenario_id
       LEFT JOIN call_turns ct ON ct.call_attempt_id = ca.id
       WHERE ca.id = $1
       GROUP BY ca.id, ca.trainee_id, s.slug, ca.difficulty_level, ca.mode, ca.status`,
      [callAttemptId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const turnsCompleted = Number(row.turns_completed);

    return {
      callAttemptId: row.id,
      traineeId: row.trainee_id,
      scenarioSlug: row.scenario_slug,
      difficultyLevel: row.difficulty_level,
      mode: row.mode,
      status: row.status,
      currentRound: Math.min(turnsCompleted + 1, 5),
    };
  }

  async saveTurn(
    callAttemptId: string,
    roundNumber: number,
    utterance: string,
    score: {
      roundType: RoundType;
      roundScore: number;
      keywordHits: Partial<Record<ScoringKeyword, boolean>>;
      clientReaction: ClientReaction;
      clientReply: string;
      feedback: string;
      hasConcreteDayAndTime: boolean;
      won: boolean;
    },
  ): Promise<TurnRecord> {
    const turn = await this.client.query<{ id: string }>(
      `INSERT INTO call_turns (
         call_attempt_id,
         round_number,
         round_type,
         trainee_utterance,
         expected_phrase
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        callAttemptId,
        roundNumber,
        score.roundType,
        utterance,
        score.feedback,
      ],
    );

    await this.client.query(
      `INSERT INTO turn_scores (
         turn_id,
         keyword_hits,
         round_score,
         has_concrete_day_and_time,
         feedback,
         client_reaction
       )
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)`,
      [
        turn.rows[0].id,
        JSON.stringify(score.keywordHits),
        score.roundScore,
        score.hasConcreteDayAndTime,
        score.feedback,
        score.clientReaction,
      ],
    );

    return {
      turnId: turn.rows[0].id,
      roundNumber,
      roundType: score.roundType,
      traineeUtterance: utterance,
      roundScore: score.roundScore,
      keywordHits: score.keywordHits,
      clientReaction: score.clientReaction,
      clientReply: score.clientReply,
      feedback: score.feedback,
      hasConcreteDayAndTime: score.hasConcreteDayAndTime,
      won: score.won,
    };
  }

  async endSession(callAttemptId: string): Promise<EndSessionResult> {
    const scores = await this.client.query<{ round_score: string }>(
      `SELECT ts.round_score
       FROM call_turns ct
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ct.call_attempt_id = $1
       ORDER BY ct.round_number`,
      [callAttemptId],
    );

    const cierre = await this.client.query<{
      keyword_hits: Partial<Record<ScoringKeyword, boolean>>;
      has_concrete_day_and_time: boolean;
      difficulty_level: DifficultyLevel;
      trainee_utterance: string | null;
    }>(
      `SELECT
         ts.keyword_hits,
         ts.has_concrete_day_and_time,
         ca.difficulty_level,
         ct.trainee_utterance
       FROM call_attempts ca
       JOIN call_turns ct ON ct.call_attempt_id = ca.id AND ct.round_type = 'cierre'
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ca.id = $1`,
      [callAttemptId],
    );

    const totalScore =
      scores.rows.length > 0
        ? scores.rows.reduce((sum, row) => sum + Number(row.round_score), 0) /
          scores.rows.length
        : 0;

    let won = false;

    if (cierre.rows.length > 0) {
      const row = cierre.rows[0];
      const utterance = row.trainee_utterance ?? "";
      const hasDay =
        /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+de)/i.test(
          utterance,
        );
      const hasTime = /\d{1,2}[:h]\d{2}|\d{1,2}\s*(am|pm|hrs?)/i.test(utterance);

      won = evaluateCloseWinFromScore(
        row.difficulty_level,
        hasDay,
        hasTime,
        Boolean(row.keyword_hits.reunion),
        Boolean(row.keyword_hits.dia_hora),
      );
    }

    const turnsCompleted = scores.rows.length;

    await this.client.query(
      `UPDATE call_attempts
       SET status = 'completed',
           won = $2,
           total_score = $3,
           ended_at = now()
       WHERE id = $1`,
      [callAttemptId, won, totalScore],
    );

    return {
      callAttemptId,
      status: "completed",
      won,
      totalScore: Math.round(totalScore * 100) / 100,
      turnsCompleted,
    };
  }

  getRoundType(roundNumber: number): RoundType | null {
    return getRoundTypeForNumber(roundNumber);
  }

  async listHistoryForTrainee(traineeId: string): Promise<HistoryEntry[]> {
    const { rows } = await this.client.query<{
      call_attempt_id: string;
      trainee_id: string;
      scenario_slug: string;
      client_name: string;
      difficulty_level: number;
      mode: PracticeMode;
      status: CallStatus;
      won: boolean | null;
      total_score: string | null;
      started_at: Date;
      ended_at: Date | null;
      turns_completed: number;
    }>(
      `SELECT
         call_attempt_id,
         trainee_id,
         scenario_slug,
         client_name,
         difficulty_level,
         mode,
         status,
         won,
         total_score,
         started_at,
         ended_at,
         turns_completed
       FROM call_history
       WHERE trainee_id = $1
       ORDER BY started_at DESC`,
      [traineeId],
    );

    return rows.map((row) => ({
      callAttemptId: row.call_attempt_id,
      traineeId: row.trainee_id,
      scenarioSlug: row.scenario_slug,
      clientName: row.client_name,
      difficultyLevel: row.difficulty_level as DifficultyLevel,
      mode: row.mode,
      status: row.status,
      won: row.won,
      totalScore: row.total_score === null ? null : Number(row.total_score),
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at ? row.ended_at.toISOString() : null,
      turnsCompleted: row.turns_completed,
    }));
  }
}
