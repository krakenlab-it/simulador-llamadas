import type { CallTypeOverlay, ScoreDimensionId } from "./types";

export interface DimensionDefinition {
  id: ScoreDimensionId;
  label: string;
  baseWeight: number;
}

export const SCORE_DIMENSIONS: readonly DimensionDefinition[] = [
  { id: "apertura_contrato", label: "Apertura y contrato", baseWeight: 0.15 },
  { id: "discovery_escucha", label: "Discovery y escucha", baseWeight: 0.25 },
  { id: "dolor_implicacion", label: "Dolor e implicación", baseWeight: 0.2 },
  { id: "valor_tailor", label: "Valor / tailor", baseWeight: 0.15 },
  { id: "compostura_objecion", label: "Compostura ante objeción", baseWeight: 0.1 },
  { id: "cierre_siguiente_paso", label: "Cierre / siguiente paso", baseWeight: 0.15 },
] as const;

const OVERLAY_MULTIPLIERS: Record<
  CallTypeOverlay,
  Partial<Record<ScoreDimensionId, number>>
> = {
  fria: {
    apertura_contrato: 1.35,
    cierre_siguiente_paso: 1.35,
  },
  discovery: {
    discovery_escucha: 1.35,
    dolor_implicacion: 1.35,
  },
  cierre: {
    compostura_objecion: 1.35,
    cierre_siguiente_paso: 1.35,
  },
};

export function resolveDimensionWeights(
  callType: CallTypeOverlay,
  objectionApplicable: boolean,
): Map<ScoreDimensionId, number> {
  const multipliers = OVERLAY_MULTIPLIERS[callType];
  const weights = new Map<ScoreDimensionId, number>();

  for (const dim of SCORE_DIMENSIONS) {
    if (dim.id === "compostura_objecion" && !objectionApplicable) {
      continue;
    }
    const multiplier = multipliers[dim.id] ?? 1;
    weights.set(dim.id, dim.baseWeight * multiplier);
  }

  const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  for (const [id, weight] of weights) {
    weights.set(id, weight / total);
  }

  return weights;
}

export function scoreToHundred(stars: number): number {
  const clamped = Math.max(1, Math.min(5, stars));
  return Math.round(((clamped - 1) / 4) * 100);
}

export function starsFromHundred(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round((clamped / 100) * 4 + 1);
}

export function computeOverallScore(
  dimensions: { id: ScoreDimensionId; score: number; notApplicable?: boolean }[],
  callType: CallTypeOverlay,
  objectionApplicable: boolean,
): { overallScore: number; overallStars: number } {
  const weights = resolveDimensionWeights(callType, objectionApplicable);
  let weighted = 0;

  for (const dim of dimensions) {
    if (dim.notApplicable) continue;
    const weight = weights.get(dim.id);
    if (!weight) continue;
    weighted += scoreToHundred(dim.score) * weight;
  }

  const overallScore = Math.round(weighted);
  return {
    overallScore,
    overallStars: starsFromHundred(overallScore),
  };
}

export function getDimensionLabel(id: ScoreDimensionId): string {
  return SCORE_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}
