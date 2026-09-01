import type { Client } from "pg";
import type {
  CallStatus,
  DifficultyLevel,
  PracticeMode,
  RoundType,
} from "@/lib/db/types";
import { getRoundTypeForNumber } from "@/lib/extension-points/session";
import { buildSessionEvaluation } from "@/lib/feedback/evaluation";
import type {
  RichTurnFeedback,
  ScenarioConfig,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";
import type { ClientReaction } from "@/lib/scoring/rondas";
import { scoreCall } from "@/lib/scoring/score-call";
import { buildTranscriptFromTurns } from "@/lib/scoring/transcript";
import type { TranscriptLine } from "@/lib/scoring/types";
import { CLINIC_PHASE_COUNT } from "@/lib/simulation/rounds";
import { SESSION_MAX_TURN_ALLOCATIONS } from "@/lib/voice/brakes";
import { SessionError } from "./errors";
import { resolveEndSessionWin } from "./win";

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
  clientName: string;
  isPreset: boolean;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  currentRound: number;
  totalRounds: number;
  config: ScenarioConfig | null;
}

export interface TurnScoreInput {
  roundType: RoundType | null;
  roundKey: string;
  roundLabel: string;
  roundScore: number;
  keywordHits: Record<string, boolean>;
  clientReaction: ClientReaction;
  clientReply: string;
  feedback: string;
  richFeedback: RichTurnFeedback;
  hasConcreteDayAndTime: boolean;
  won: boolean;
}

/** Outcome of atomically claiming the next round of a call. */
export type TurnSlot =
  | { kind: "reserved"; turnId: string; roundNumber: number }
  | { kind: "replay"; turn: TurnRecord };

export interface TurnRecord {
  turnId: string;
  roundNumber: number;
  roundType: RoundType | null;
  roundKey: string;
  roundLabel: string;
  traineeUtterance: string;
  roundScore: number;
  keywordHits: Record<string, boolean>;
  clientReaction: ClientReaction;
  clientReply: string;
  feedback: string;
  richFeedback: RichTurnFeedback;
  hasConcreteDayAndTime: boolean;
  won: boolean;
}

export interface EndSessionResult {
  callAttemptId: string;
  status: CallStatus;
  won: boolean;
  totalScore: number;
  turnsCompleted: number;
  totalRounds: number;
  evaluation: SessionEvaluationSummary;
}

export interface HistoryEntry {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  industry: string | null;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  won: boolean | null;
  totalScore: number | null;
  startedAt: string;
  endedAt: string | null;
  turnsCompleted: number;
}

interface ScenarioContext {
  id: string;
  slug: string;
  clientName: string;
  isPreset: boolean;
  config: ScenarioConfig | null;
  totalRounds: number;
}

function parseConfig(raw: unknown): ScenarioConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const config = raw as ScenarioConfig;
  if (!Array.isArray(config.rounds) || config.rounds.length === 0) return null;
  return config;
}

function getScoringPhaseCount(): number {
  return CLINIC_PHASE_COUNT;
}

function getMaxTurnAllocations(): number {
  return SESSION_MAX_TURN_ALLOCATIONS;
}

export class SessionRepository {
  constructor(private readonly client: Client) {}

  private async loadScenario(slug: string): Promise<ScenarioContext> {
    const { rows } = await this.client.query<{
      id: string;
      slug: string;
      client_name: string;
      is_preset: boolean;
      config: ScenarioConfig;
    }>(
      `SELECT id, slug, client_name, is_preset, config FROM scenarios WHERE slug = $1`,
      [slug],
    );

    if (rows.length === 0) {
      throw new Error(`Unknown scenario slug: ${slug}`);
    }

    const row = rows[0];
    const config = row.is_preset ? null : parseConfig(row.config);

    return {
      id: row.id,
      slug: row.slug,
      clientName: row.client_name,
      isPreset: row.is_preset,
      config,
      totalRounds: getScoringPhaseCount(),
    };
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const scenario = await this.loadScenario(input.scenarioSlug);

    const attempt = await this.client.query<{ id: string }>(
      `INSERT INTO call_attempts (trainee_id, scenario_id, difficulty_level, mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.traineeId, scenario.id, input.difficultyLevel, input.mode],
    );

    return {
      callAttemptId: attempt.rows[0].id,
      traineeId: input.traineeId,
      scenarioSlug: scenario.slug,
      clientName: scenario.clientName,
      isPreset: scenario.isPreset,
      difficultyLevel: input.difficultyLevel,
      mode: input.mode,
      status: "in_progress",
      currentRound: 1,
      totalRounds: scenario.totalRounds,
      config: scenario.config,
    };
  }

  async getSession(callAttemptId: string): Promise<SessionRecord | null> {
    const result = await this.client.query<{
      id: string;
      trainee_id: string;
      scenario_slug: string;
      client_name: string;
      is_preset: boolean;
      config: ScenarioConfig;
      difficulty_level: DifficultyLevel;
      mode: PracticeMode;
      status: CallStatus;
      last_round: string;
    }>(
      `SELECT
         ca.id,
         ca.trainee_id,
         s.slug AS scenario_slug,
         s.client_name,
         s.is_preset,
         s.config,
         ca.difficulty_level,
         ca.mode,
         ca.status,
         COALESCE(MAX(ct.round_number), 0)::text AS last_round
       FROM call_attempts ca
       JOIN scenarios s ON s.id = ca.scenario_id
       LEFT JOIN call_turns ct ON ct.call_attempt_id = ca.id
       WHERE ca.id = $1
       GROUP BY ca.id, ca.trainee_id, s.slug, s.client_name, s.is_preset, s.config,
                ca.difficulty_level, ca.mode, ca.status`,
      [callAttemptId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const config = row.is_preset ? null : parseConfig(row.config);
    const totalRounds = getScoringPhaseCount();

    return {
      callAttemptId: row.id,
      traineeId: row.trainee_id,
      scenarioSlug: row.scenario_slug,
      clientName: row.client_name,
      isPreset: row.is_preset,
      difficultyLevel: row.difficulty_level,
      mode: row.mode,
      status: row.status,
      currentRound: Number(row.last_round) + 1,
      totalRounds,
      config,
    };
  }

  /**
   * Claims the next round for this call in a single statement: the database
   * assigns round_number under a row lock on the parent attempt, so two
   * simultaneous submits can never compute the same number. A submit that
   * carries an already-scored clientTurnId gets that turn back instead of a
   * unique-constraint error.
   */
  async reserveTurnSlot(
    callAttemptId: string,
    utterance: string,
    options: { clientTurnId?: string | null } = {},
  ): Promise<TurnSlot> {
    const { rows } = await this.client.query<{
      allocation_status: string;
      turn_id: string | null;
      round_number: number | null;
    }>(
      `SELECT allocation_status, turn_id, round_number
       FROM allocate_call_turn($1, $2, $3, $4)`,
      [
        callAttemptId,
        utterance,
        options.clientTurnId ?? null,
        getMaxTurnAllocations(),
      ],
    );

    const allocation = rows[0];

    switch (allocation?.allocation_status) {
      case "reserved":
        return {
          kind: "reserved",
          turnId: allocation.turn_id!,
          roundNumber: Number(allocation.round_number),
        };
      case "replay": {
        const turn = await this.getTurn(allocation.turn_id!);
        if (!turn) throw new SessionError("turn_failed");
        return { kind: "replay", turn };
      }
      case "not_found":
        throw new SessionError("session_not_found");
      case "not_in_progress":
        throw new SessionError("session_not_in_progress");
      case "rounds_exhausted":
        throw new SessionError("rounds_completed");
      default:
        throw new SessionError("turn_failed");
    }
  }

  /** Fills a reserved slot with its round metadata and score. */
  async completeTurn(
    turnId: string,
    roundNumber: number,
    utterance: string,
    score: TurnScoreInput,
  ): Promise<TurnRecord> {
    try {
      await this.client.query("BEGIN");

      await this.client.query(
        `UPDATE call_turns
         SET round_type = $2, round_key = $3, round_label = $4,
             trainee_utterance = $5, expected_phrase = $6
         WHERE id = $1`,
        [
          turnId,
          score.roundType,
          score.roundKey,
          score.roundLabel,
          utterance,
          score.richFeedback.strongerLine,
        ],
      );

      await this.client.query(
        `INSERT INTO turn_scores (
           turn_id, keyword_hits, round_score, has_concrete_day_and_time,
           feedback, client_reaction, feedback_detail, client_reply, won
         )
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (turn_id) DO UPDATE SET
           keyword_hits = EXCLUDED.keyword_hits,
           round_score = EXCLUDED.round_score,
           has_concrete_day_and_time = EXCLUDED.has_concrete_day_and_time,
           feedback = EXCLUDED.feedback,
           client_reaction = EXCLUDED.client_reaction,
           feedback_detail = EXCLUDED.feedback_detail,
           client_reply = EXCLUDED.client_reply,
           won = EXCLUDED.won`,
        [
          turnId,
          JSON.stringify(score.keywordHits),
          score.roundScore,
          score.hasConcreteDayAndTime,
          score.feedback,
          score.clientReaction,
          JSON.stringify(score.richFeedback),
          score.clientReply,
          score.won,
        ],
      );

      await this.client.query("COMMIT");
    } catch (error) {
      await this.client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    return {
      turnId,
      roundNumber,
      roundType: score.roundType,
      roundKey: score.roundKey,
      roundLabel: score.roundLabel,
      traineeUtterance: utterance,
      roundScore: score.roundScore,
      keywordHits: score.keywordHits,
      clientReaction: score.clientReaction,
      clientReply: score.clientReply,
      feedback: score.feedback,
      richFeedback: score.richFeedback,
      hasConcreteDayAndTime: score.hasConcreteDayAndTime,
      won: score.won,
    };
  }

  /** Frees a reservation whose scoring failed, so the round is not burned. */
  async releaseTurnSlot(turnId: string): Promise<void> {
    await this.client.query(
      `DELETE FROM call_turns ct
       WHERE ct.id = $1
         AND NOT EXISTS (SELECT 1 FROM turn_scores ts WHERE ts.turn_id = ct.id)`,
      [turnId],
    );
  }

  async getTranscriptLines(callAttemptId: string): Promise<TranscriptLine[]> {
    const { rows } = await this.client.query<{
      trainee_utterance: string | null;
      client_reply: string | null;
    }>(
      `SELECT ct.trainee_utterance, ts.client_reply
       FROM call_turns ct
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ct.call_attempt_id = $1
       ORDER BY ct.round_number`,
      [callAttemptId],
    );

    const lines: TranscriptLine[] = [];
    for (const row of rows) {
      if (row.trainee_utterance) {
        lines.push({ role: "trainee", text: row.trainee_utterance });
      }
      if (row.client_reply) {
        lines.push({ role: "client", text: row.client_reply });
      }
    }
    return lines;
  }

  async getTurn(turnId: string): Promise<TurnRecord | null> {
    const { rows } = await this.client.query<{
      round_number: number;
      round_type: RoundType | null;
      round_key: string | null;
      round_label: string | null;
      trainee_utterance: string | null;
      round_score: string;
      keyword_hits: Record<string, boolean>;
      client_reaction: ClientReaction;
      client_reply: string | null;
      feedback: string | null;
      feedback_detail: RichTurnFeedback;
      has_concrete_day_and_time: boolean;
      won: boolean;
    }>(
      `SELECT ct.round_number, ct.round_type, ct.round_key, ct.round_label,
              ct.trainee_utterance, ts.round_score, ts.keyword_hits,
              ts.client_reaction, ts.client_reply, ts.feedback,
              ts.feedback_detail, ts.has_concrete_day_and_time, ts.won
       FROM call_turns ct
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ct.id = $1`,
      [turnId],
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    return {
      turnId,
      roundNumber: Number(row.round_number),
      roundType: row.round_type,
      roundKey: row.round_key ?? row.round_type ?? "round",
      roundLabel: row.round_label ?? row.round_type ?? "Ronda",
      traineeUtterance: row.trainee_utterance ?? "",
      roundScore: Number(row.round_score),
      keywordHits: row.keyword_hits,
      clientReaction: row.client_reaction,
      clientReply: row.client_reply ?? "",
      feedback: row.feedback ?? "",
      richFeedback: row.feedback_detail,
      hasConcreteDayAndTime: row.has_concrete_day_and_time,
      won: row.won,
    };
  }

  async endSession(callAttemptId: string): Promise<EndSessionResult> {
    const session = await this.getSession(callAttemptId);
    if (!session) throw new Error("Session not found");

    const turnRows = await this.client.query<{
      round_key: string;
      round_label: string;
      round_type: RoundType | null;
      round_score: string;
      feedback_detail: RichTurnFeedback;
      trainee_utterance: string | null;
      client_reply: string | null;
    }>(
      `SELECT
         ct.round_key, ct.round_label, ct.round_type, ct.trainee_utterance,
         ts.round_score, ts.feedback_detail, ts.client_reply
       FROM call_turns ct
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ct.call_attempt_id = $1
       ORDER BY ct.round_number`,
      [callAttemptId],
    );

    const closeRoundKey = session.isPreset
      ? "cierre"
      : (session.config?.rounds[session.config.rounds.length - 1]?.key ?? "cierre");

    const turns = turnRows.rows.map((row) => ({
      roundType: row.round_type,
      roundKey: row.round_key,
      traineeUtterance: row.trainee_utterance,
    }));

    const transcriptLines = buildTranscriptFromTurns(
      turnRows.rows.map((row) => ({
        utterance: row.trainee_utterance ?? "",
        clientReply: row.client_reply ?? undefined,
      })),
    );

    const historyForScenario = await this.listHistoryForTrainee(
      session.traineeId,
      session.scenarioSlug,
    );

    const sessionScore = await scoreCall({
      lines: transcriptLines,
      config: session.config,
      isPreset: session.isPreset,
    });

    const won = resolveEndSessionWin(
      {
        isPreset: session.isPreset,
        closeRoundKey,
        config: session.config,
      },
      turns,
    );

    const totalScore = sessionScore.scorecard.overallScore;

    const evaluation = buildSessionEvaluation(
      turnRows.rows.map((row) => ({
        roundKey: row.round_key ?? row.round_type ?? "round",
        roundLabel: row.round_label ?? row.round_type ?? "Ronda",
        roundScore: Number(row.round_score),
        richFeedback: row.feedback_detail,
      })),
      won,
      session.config,
      historyForScenario
        .filter((h) => h.status === "completed")
        .map((h) => ({ totalScore: h.totalScore, startedAt: h.startedAt })),
      sessionScore,
    );

    await this.client.query(
      `UPDATE call_attempts
       SET status = 'completed', won = $2, total_score = $3,
           ended_at = now(), evaluation_summary = $4::jsonb
       WHERE id = $1`,
      [callAttemptId, won, totalScore, JSON.stringify(evaluation)],
    );

    return {
      callAttemptId,
      status: "completed",
      won,
      totalScore: Math.round(totalScore * 100) / 100,
      turnsCompleted: turnRows.rows.length,
      totalRounds: session.totalRounds,
      evaluation,
    };
  }

  getRoundDef(
    session: SessionRecord,
    roundNumber: number,
  ): { key: string; label: string; goal: string; roundType: RoundType | null } {
    if (session.isPreset) {
      const roundType = getRoundTypeForNumber(roundNumber);
      const labels: Record<string, string> = {
        apertura: "Apertura",
        objecion: "Objeción",
        claridad: "Claridad",
        correo: "Correo",
        cierre: "Cierre",
      };
      return {
        key: roundType ?? `round-${roundNumber}`,
        label: roundType ? labels[roundType] : `Ronda ${roundNumber}`,
        goal: "",
        roundType,
      };
    }

    const rounds = session.config?.rounds ?? [];
    const phaseIndex = Math.min(roundNumber - 1, rounds.length - 1);
    const round = rounds[phaseIndex];
    if (!round) {
      throw new SessionError("invalid_round");
    }

    return {
      key: round.key,
      label: round.label,
      goal: round.goal,
      roundType: null,
    };
  }

  async listHistoryForTrainee(
    traineeId: string,
    scenarioSlug?: string,
  ): Promise<HistoryEntry[]> {
    const params: string[] = [traineeId];
    let slugFilter = "";

    if (scenarioSlug) {
      params.push(scenarioSlug);
      slugFilter = "AND scenario_slug = $2";
    }

    const { rows } = await this.client.query<{
      call_attempt_id: string;
      trainee_id: string;
      scenario_slug: string;
      client_name: string;
      is_preset: boolean;
      industry: string | null;
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
         call_attempt_id, trainee_id, scenario_slug, client_name,
         is_preset, industry, difficulty_level, mode, status, won,
         total_score, started_at, ended_at, turns_completed
       FROM call_history
       WHERE trainee_id = $1 ${slugFilter}
       ORDER BY started_at DESC`,
      params,
    );

    return rows.map((row) => ({
      callAttemptId: row.call_attempt_id,
      traineeId: row.trainee_id,
      scenarioSlug: row.scenario_slug,
      clientName: row.client_name,
      isPreset: row.is_preset,
      industry: row.industry,
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
