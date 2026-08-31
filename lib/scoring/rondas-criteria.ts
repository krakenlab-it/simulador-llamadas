import type { RoundType, ScoringKeyword } from "@/lib/db/types";

/** Exported for adaptive scoring — clinic preset positive criteria per round. */
export const ROUND_POSITIVES: Record<RoundType, ScoringKeyword[]> = {
  apertura: ["reconocimiento", "medicion", "se_presenta_solo", "jerga"],
  objecion: ["reconocimiento", "jerga", "problema"],
  claridad: ["problema", "medicion"],
  correo: ["reunion"],
  cierre: ["reunion", "dia_hora"],
};

export const ROUND_NEGATIVES: Record<RoundType, ScoringKeyword[]> = {
  apertura: ["monologo", "telegrama", "gratis"],
  objecion: ["descalifica", "monologo", "telegrama"],
  claridad: ["monologo", "telegrama", "descalifica"],
  correo: ["gratis", "monologo", "telegrama"],
  cierre: ["monologo", "telegrama", "descalifica"],
};

export const GLOBAL_POSITIVES: ScoringKeyword[] = [
  "problema",
  "medicion",
  "jerga",
  "reconocimiento",
  "reunion",
  "dia_hora",
];
