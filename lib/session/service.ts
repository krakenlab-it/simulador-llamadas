import type { Client } from "pg";
import type { DifficultyLevel, RoundType, ScoringKeyword } from "@/lib/db/types";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { scoreTurnAdaptive } from "@/lib/scoring/adaptive";
import { SessionError, toSessionError } from "./errors";
import {
  SessionRepository,
  type CreateSessionInput,
  type EndSessionResult,
  type HistoryEntry,
  type SessionRecord,
  type TurnRecord,
  type TurnSlot,
} from "./repository";

export interface SubmitTurnInput {
  callAttemptId: string;
  utterance: string;
  /** Idempotency key for one user submit action; a retry reuses it. */
  clientTurnId?: string | null;
}

export class SessionService {
  private readonly repository: SessionRepository;

  constructor(client: Client) {
    this.repository = new SessionRepository(client);
  }

  async startSession(input: CreateSessionInput): Promise<SessionRecord> {
    return this.repository.createSession(input);
  }

  /**
   * One round of the call. The round number is allocated by the database, not
   * derived from a count the client could race, and scoring runs outside any
   * lock. If scoring fails the reservation is released so the trainee can
   * retry the same round.
   */
  async submitTurn(input: SubmitTurnInput): Promise<TurnRecord> {
    const trimmed = input.utterance.trim();
    if (!trimmed) throw new SessionError("empty_utterance");

    const session = await this.repository.getSession(input.callAttemptId);
    if (!session) throw new SessionError("session_not_found");

    let slot: TurnSlot;
    try {
      slot = await this.repository.reserveTurnSlot(input.callAttemptId, trimmed, {
        clientTurnId: input.clientTurnId ?? null,
        maxRounds: session.totalRounds,
      });
    } catch (error) {
      throw toSessionError(error);
    }

    if (slot.kind === "replay") return slot.turn;

    try {
      const roundDef = this.repository.getRoundDef(session, slot.roundNumber);
      const isLastRound = slot.roundNumber === session.totalRounds;

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

      return await this.repository.completeTurn(
        slot.turnId,
        slot.roundNumber,
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
    } catch (error) {
      await this.repository.releaseTurnSlot(slot.turnId).catch(() => undefined);
      throw toSessionError(error);
    }
  }

  async endSession(callAttemptId: string): Promise<EndSessionResult> {
    const session = await this.repository.getSession(callAttemptId);
    if (!session) throw new SessionError("session_not_found");
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

export interface EndSessionTurnInput {
  roundType: RoundType | null;
  roundKey: string | null;
  traineeUtterance: string | null;
  keywordHits: Partial<Record<ScoringKeyword, boolean>>;
}

export function utteranceHasDay(utterance: string): boolean {
  return /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+de)/i.test(
    utterance,
  );
}

export function utteranceHasTime(utterance: string): boolean {
  return /\d{1,2}[:h]\d{2}|\d{1,2}\s*(am|pm|hrs?)/i.test(utterance);
}

/**
 * Session-level win at hang-up. Clinic presets require a submitted cierre turn
 * (matches main @ 5475a77). Custom scenarios evaluate only on the final round.
 */
export function resolveEndSessionWin(
  options: {
    isPreset: boolean;
    difficultyLevel: DifficultyLevel;
    closeRoundKey: string | null;
  },
  turns: EndSessionTurnInput[],
): boolean {
  if (turns.length === 0) {
    return false;
  }

  let closeTurn: EndSessionTurnInput | undefined;

  if (options.isPreset) {
    closeTurn = turns.find((turn) => turn.roundType === "cierre");
    if (!closeTurn) {
      return false;
    }
  } else {
    const lastTurn = turns[turns.length - 1];
    const closeKeys = new Set(
      ["cierre", options.closeRoundKey].filter((key): key is string => Boolean(key)),
    );
    if (!lastTurn.roundKey || !closeKeys.has(lastTurn.roundKey)) {
      return false;
    }
    closeTurn = lastTurn;
  }

  const utterance = closeTurn.traineeUtterance ?? "";

  return evaluateCloseWinFromScore(
    options.difficultyLevel,
    utteranceHasDay(utterance),
    utteranceHasTime(utterance),
    Boolean(closeTurn.keywordHits.reunion),
    Boolean(closeTurn.keywordHits.dia_hora),
  );
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
