import type { DifficultyLevel, RoundType } from "@/lib/db/types";
import { scoreTurn, type ScoreTurnResult } from "@/lib/scoring";
import { analizar } from "@/lib/scoring/analizar";
import { DAY_PATTERN, TIME_PATTERN } from "@/lib/scoring/keywords";
import { puntua } from "@/lib/scoring/rondas";
import type { ScoringKeyword } from "@/lib/db/types";

/**
 * Scoring extension point — delegates to lib/scoring (prototype port).
 */

export interface ScoringInput {
  utterance: string;
  roundType: RoundType;
  difficultyLevel?: DifficultyLevel;
  scenarioSlug?: string;
}

export interface ScoringResult {
  keywordHits: Partial<Record<ScoringKeyword, boolean>>;
  roundScore: number;
  feedback: string;
  hasConcreteDayAndTime: boolean;
  clientReaction?: ScoreTurnResult["clientReaction"];
  clientReply?: string;
  won?: boolean;
}

export function detectConcreteDayAndTime(utterance: string): boolean {
  return DAY_PATTERN.test(utterance) && TIME_PATTERN.test(utterance);
}

export function scoreUtterance(input: ScoringInput): ScoringResult {
  if (input.difficultyLevel && input.scenarioSlug) {
    const result = scoreTurn({
      utterance: input.utterance,
      roundType: input.roundType,
      difficultyLevel: input.difficultyLevel,
      scenarioSlug: input.scenarioSlug,
    });
    return {
      keywordHits: result.keywordHits,
      roundScore: result.roundScore,
      feedback: result.feedback,
      hasConcreteDayAndTime: result.hasConcreteDayAndTime,
      clientReaction: result.clientReaction,
      clientReply: result.clientReply,
      won: result.won,
    };
  }

  const analisis = analizar(input.utterance);
  const puntuacion = puntua(input.roundType, analisis, 2);

  return {
    keywordHits: analisis.hits,
    roundScore: puntuacion.roundScore,
    feedback: puntuacion.feedback,
    hasConcreteDayAndTime: puntuacion.hasConcreteDayAndTime,
    won: puntuacion.won,
  };
}

/** @deprecated Use scoreUtterance */
export const scoreUtterancePlaceholder = scoreUtterance;

export { analizar, puntua, scoreTurn };
