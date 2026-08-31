import type { DifficultyLevel, RoundType, ScoringKeyword } from "@/lib/db/types";
import type { AnalisisResult } from "./analizar";

export type ClientReaction = "bien" | "medio" | "mal";

export interface PuntuacionRonda {
  roundScore: number;
  feedback: string;
  reaction: ClientReaction;
  won: boolean;
  hasConcreteDayAndTime: boolean;
}

export const ROUND_EXPECTED: Record<RoundType, string> = {
  apertura:
    "Reconozca el indicador del cliente y proponga medición, sin monólogo ni telegrama.",
  objecion: "Valide la objeción, use jerga del sector y evite descalificar.",
  claridad: "Nombre el problema concreto y cómo lo medirían juntos.",
  correo: "Pida permiso para enviar algo breve; no diga gratis sin contexto.",
  cierre: "Proponga reunión con día Y hora concretos. Sin ambigüedad.",
};

const ROUND_POSITIVES: Record<RoundType, ScoringKeyword[]> = {
  apertura: ["reconocimiento", "medicion", "se_presenta_solo", "jerga"],
  objecion: ["reconocimiento", "jerga", "problema"],
  claridad: ["problema", "medicion"],
  correo: ["reunion"],
  cierre: ["reunion", "dia_hora"],
};

const ROUND_NEGATIVES: Record<RoundType, ScoringKeyword[]> = {
  apertura: ["monologo", "telegrama", "gratis"],
  objecion: ["descalifica", "monologo", "telegrama"],
  claridad: ["monologo", "telegrama", "descalifica"],
  correo: ["gratis", "monologo", "telegrama"],
  cierre: ["monologo", "telegrama", "descalifica"],
};

const GLOBAL_POSITIVES: ScoringKeyword[] = [
  "problema",
  "medicion",
  "jerga",
  "reconocimiento",
  "reunion",
  "dia_hora",
];

function reactionFromScore(score: number): ClientReaction {
  if (score >= 55) {
    return "bien";
  }
  if (score >= 30) {
    return "medio";
  }
  return "mal";
}

function computeRoundScore(
  analisis: AnalisisResult,
  roundType: RoundType,
): number {
  const roundPositives = ROUND_POSITIVES[roundType];
  const roundNegatives = ROUND_NEGATIVES[roundType];

  const roundPositiveHits = roundPositives.filter(
    (keyword) => analisis.hits[keyword],
  ).length;
  const globalPositiveHits = GLOBAL_POSITIVES.filter(
    (keyword) => analisis.hits[keyword],
  ).length;
  const positives = Math.max(roundPositiveHits, globalPositiveHits);

  const negatives = roundNegatives.filter(
    (keyword) => analisis.hits[keyword],
  ).length;

  return Math.max(0, Math.min(100, positives * 14 - negatives * 10));
}

function evaluateCloseWin(
  analisis: AnalisisResult,
  difficultyLevel: DifficultyLevel,
): boolean {
  const hasReunion = analisis.hits.reunion;

  if (difficultyLevel === 1) {
    return hasReunion && (analisis.hasDay || analisis.hits.dia_hora);
  }

  return hasReunion && analisis.hasDay && analisis.hasTime;
}

/**
 * Round-specific scoring (`RONDAS.puntua`) from prototype rules.
 */
export function puntua(
  roundType: RoundType,
  analisis: AnalisisResult,
  difficultyLevel: DifficultyLevel,
): PuntuacionRonda {
  const roundScore = computeRoundScore(analisis, roundType);
  const reaction = reactionFromScore(roundScore);
  const hasConcreteDayAndTime = analisis.hasDay && analisis.hasTime;
  const won =
    roundType === "cierre"
      ? evaluateCloseWin(analisis, difficultyLevel)
      : false;

  return {
    roundScore,
    feedback: ROUND_EXPECTED[roundType],
    reaction,
    won,
    hasConcreteDayAndTime,
  };
}
