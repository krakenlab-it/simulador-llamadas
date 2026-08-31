import type { Client } from "pg";
import type {
  CallStatus,
  DifficultyLevel,
  PracticeMode,
  RoundType,
  ScoringKeyword,
} from "@/lib/db/types";
import { getRoundTypeForNumber } from "@/lib/extension-points/session";
import { buildSessionEvaluation } from "@/lib/feedback/evaluation";
import type {
  RichTurnFeedback,
  ScenarioConfig,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";
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
  clientName: string;
  isPreset: boolean;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  currentRound: number;
  totalRounds: number;
  config: ScenarioConfig | null;
}

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

const FIVE_ROUND_ENGINE = 5;

function getTotalRounds(): number {
  return FIVE_ROUND_ENGINE;
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
      totalRounds: getTotalRounds(),
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
      turns_completed: string;
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
         COUNT(ct.id)::text AS turns_completed
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
    const turnsCompleted = Number(row.turns_completed);
    const config = row.is_preset ? null : parseConfig(row.config);
    const totalRounds = getTotalRounds();

    return {
      callAttemptId: row.id,
      traineeId: row.trainee_id,
      scenarioSlug: row.scenario_slug,
      clientName: row.client_name,
      isPreset: row.is_preset,
      difficultyLevel: row.difficulty_level,
      mode: row.mode,
      status: row.status,
      currentRound: Math.min(turnsCompleted + 1, totalRounds),
      totalRounds,
      config,
    };
  }

  async saveTurn(
    callAttemptId: string,
    roundNumber: number,
    utterance: string,
    score: {
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
    },
  ): Promise<TurnRecord> {
    const turn = await this.client.query<{ id: string }>(
      `INSERT INTO call_turns (
         call_attempt_id, round_number, round_type, round_key, round_label,
         trainee_utterance, expected_phrase
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        callAttemptId,
        roundNumber,
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
         feedback, client_reaction, feedback_detail
       )
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7::jsonb)`,
      [
        turn.rows[0].id,
        JSON.stringify(score.keywordHits),
        score.roundScore,
        score.hasConcreteDayAndTime,
        score.feedback,
        score.clientReaction,
        JSON.stringify(score.richFeedback),
      ],
    );

    return {
      turnId: turn.rows[0].id,
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

  async endSession(callAttemptId: string): Promise<EndSessionResult> {
    const session = await this.getSession(callAttemptId);
    if (!session) throw new Error("Session not found");

    const turnRows = await this.client.query<{
      round_key: string;
      round_label: string;
      round_type: RoundType | null;
      round_score: string;
      feedback_detail: RichTurnFeedback;
      keyword_hits: Partial<Record<ScoringKeyword, boolean>>;
      trainee_utterance: string | null;
    }>(
      `SELECT
         ct.round_key, ct.round_label, ct.round_type, ct.trainee_utterance,
         ts.round_score, ts.feedback_detail, ts.keyword_hits
       FROM call_turns ct
       JOIN turn_scores ts ON ts.turn_id = ct.id
       WHERE ct.call_attempt_id = $1
       ORDER BY ct.round_number`,
      [callAttemptId],
    );

    const totalScore =
      turnRows.rows.length > 0
        ? turnRows.rows.reduce((sum, row) => sum + Number(row.round_score), 0) /
          turnRows.rows.length
        : 0;

    const lastTurn = turnRows.rows[turnRows.rows.length - 1];
    let won = false;

    if (lastTurn) {
      const utterance = lastTurn.trainee_utterance ?? "";
      const hasDay =
        /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+de)/i.test(
          utterance,
        );
      const hasTime = /\d{1,2}[:h]\d{2}|\d{1,2}\s*(am|pm|hrs?)/i.test(utterance);

      won = evaluateCloseWinFromScore(
        session.difficultyLevel,
        hasDay,
        hasTime,
        Boolean(lastTurn.keyword_hits?.reunion),
        Boolean(lastTurn.keyword_hits?.dia_hora),
      );

      if (!session.isPreset && lastTurn.round_key) {
        const lastRoundWon = turnRows.rows.some((_, i) => i === turnRows.rows.length - 1);
        if (lastRoundWon && session.config) {
          const closeKeys = ["cierre", session.config.rounds[session.config.rounds.length - 1]?.key];
          if (closeKeys.includes(lastTurn.round_key)) {
            won = evaluateCloseWinFromScore(
              session.difficultyLevel,
              hasDay,
              hasTime,
              Boolean(lastTurn.keyword_hits?.reunion),
              Boolean(lastTurn.keyword_hits?.dia_hora),
            );
          }
        }
      }
    }

    const historyForScenario = await this.listHistoryForTrainee(
      session.traineeId,
      session.scenarioSlug,
    );

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

    const round = session.config?.rounds[roundNumber - 1];
    if (!round) {
      throw new Error("Invalid round number");
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
