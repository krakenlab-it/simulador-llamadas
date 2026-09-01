export type CallTypeOverlay = "fria" | "discovery" | "cierre";

export type ScoreDimensionId =
  | "apertura_contrato"
  | "discovery_escucha"
  | "dolor_implicacion"
  | "valor_tailor"
  | "compostura_objecion"
  | "cierre_siguiente_paso";

export interface DimensionScore {
  id: ScoreDimensionId;
  label: string;
  score: number;
  rationale: string;
  notApplicable?: boolean;
}

export interface CallAnalytics {
  talkPercent: number;
  longestMonologueSeconds: number;
  questionTypes: {
    open: number;
    closed: number;
    clarifying: number;
  };
  patienceAfterBuyerTurnSeconds: number | null;
  hasNextStep: boolean;
}

export interface TranscriptLine {
  role: "trainee" | "client";
  text: string;
  /** Estimated seconds since call start when this line was spoken. */
  timestampSeconds?: number;
}

export interface CallScorecard {
  dimensions: DimensionScore[];
  overallScore: number;
  overallStars: number;
  callType: CallTypeOverlay;
  analytics: CallAnalytics;
}

export interface BetterLineVariants {
  variantA: string;
  variantB: string;
}

export type CallOutcome = "advance" | "continuation";

export interface CallDebrief {
  outcome: CallOutcome;
  outcomeLabel: string;
  strength: { dimension: string; quote: string };
  primaryGap: { dimension: string; quote: string };
  betterLines: BetterLineVariants;
  drill: string;
  dimensionTrend: {
    dimensionId: ScoreDimensionId;
    label: string;
    current: number;
    previous: number | null;
    direction: "up" | "down" | "flat";
  }[];
}

export interface SessionScoreResult {
  scorecard: CallScorecard;
  debrief: CallDebrief;
  won: boolean;
}
