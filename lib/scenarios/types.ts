import type { DifficultyLevel } from "@/lib/db/types";

export const CLINIC_PRESET_SLUGS = ["mariana", "rodrigo", "efrain"] as const;
export type ClinicPresetSlug = (typeof CLINIC_PRESET_SLUGS)[number];

export function isClinicPreset(slug: string): slug is ClinicPresetSlug {
  return (CLINIC_PRESET_SLUGS as readonly string[]).includes(slug);
}

export interface ScoringCriterionDef {
  id: string;
  label: string;
  pattern: string;
}

export interface ScenarioRoundDef {
  key: string;
  label: string;
  goal: string;
  clientPrompt: string;
  positiveCriteria: string[];
  negativeCriteria: string[];
}

export interface ScenarioConfig {
  industry: string;
  productSold: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
  temperament: string;
  rounds: ScenarioRoundDef[];
  criteria: ScoringCriterionDef[];
  globalPositiveCriteria: string[];
  openingLines: string[];
}

export interface ScenarioRecord {
  id: string;
  slug: string;
  isPreset: boolean;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  difficultyLabel: string;
  indicator: string;
  painPoints: string[];
  industry: string | null;
  productSold: string | null;
  temperament: string | null;
  clientProblem: string | null;
  objections: string[];
  winCriteria: string | null;
  config: ScenarioConfig;
}

export interface CreateCustomScenarioInput {
  industry: string;
  productSold: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  temperament: string;
  difficultyLabel: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
  traineeId?: string;
}

import type {
  CallAnalytics,
  CallDebrief,
  CallScorecard,
} from "@/lib/scoring/types";

export interface RichTurnFeedback {
  score: number;
  utterance: string;
  whyScore: string;
  strongerLine: string;
  missedCriteria: string[];
  roundLabel: string;
  analytics?: CallAnalytics;
}

export interface SessionEvaluationSummary {
  verdict: string;
  strongestRound: { key: string; label: string; score: number };
  weakestRound: { key: string; label: string; score: number };
  nextDrill: string;
  trend: {
    attempts: number;
    averageScore: number;
    previousAverageScore: number | null;
    improving: boolean;
    /** When false, UI must not label the trend as "Estable". */
    showStableLabel: boolean;
  } | null;
  scorecard?: CallScorecard;
  debrief?: CallDebrief;
}

export interface ScenarioSessionContext {
  slug: string;
  isPreset: boolean;
  config: ScenarioConfig | null;
  totalRounds: number;
  difficultyLevel: DifficultyLevel;
  clientName: string;
  roundDefs: ScenarioRoundDef[];
}
