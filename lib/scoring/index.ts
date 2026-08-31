export { analizar, type AnalisisResult } from "./analizar";
export { KEYWORD_MATCHERS, DAY_PATTERN, TIME_PATTERN } from "./keywords";
export {
  puntua,
  ROUND_EXPECTED,
  type ClientReaction,
  type PuntuacionRonda,
} from "./rondas";
export { getClientReply, SCENARIO_REACTIONS } from "./reactions";

import type { DifficultyLevel, RoundType } from "@/lib/db/types";
import { analizar } from "./analizar";
import { getClientReply } from "./reactions";
import { puntua } from "./rondas";

export interface ScoreTurnInput {
  utterance: string;
  roundType: RoundType;
  difficultyLevel: DifficultyLevel;
  scenarioSlug: string;
}

export interface ScoreTurnResult {
  keywordHits: ReturnType<typeof analizar>["hits"];
  hasDay: boolean;
  hasTime: boolean;
  roundScore: number;
  feedback: string;
  clientReaction: ReturnType<typeof puntua>["reaction"];
  clientReply: string;
  hasConcreteDayAndTime: boolean;
  won: boolean;
}

/**
 * Full scoring pipeline: analizar → puntua → scenario reaction line.
 */
export function scoreTurn(input: ScoreTurnInput): ScoreTurnResult {
  const analisis = analizar(input.utterance);
  const puntuacion = puntua(
    input.roundType,
    analisis,
    input.difficultyLevel,
  );
  const clientReply = getClientReply(
    input.scenarioSlug,
    input.roundType,
    puntuacion.reaction,
  );

  return {
    keywordHits: analisis.hits,
    hasDay: analisis.hasDay,
    hasTime: analisis.hasTime,
    roundScore: puntuacion.roundScore,
    feedback: puntuacion.feedback,
    clientReaction: puntuacion.reaction,
    clientReply,
    hasConcreteDayAndTime: puntuacion.hasConcreteDayAndTime,
    won: puntuacion.won,
  };
}
