import type { DifficultyLevel } from "@/lib/db/types";
import type {
  CallAnalytics,
  CallDebrief,
  CallScorecard,
  CallTypeOverlay,
  ScoreDimensionId,
} from "@/lib/scoring/types";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";

export const CLINIC_PRESET_SLUGS = ["mariana", "rodrigo", "efrain"] as const;
export type ClinicPresetSlug = (typeof CLINIC_PRESET_SLUGS)[number];

export function isClinicPreset(slug: string): slug is ClinicPresetSlug {
  return (CLINIC_PRESET_SLUGS as readonly string[]).includes(slug);
}

export const SCENARIO_LANGUAGES = ["es", "en"] as const;
export type ScenarioLanguage = (typeof SCENARIO_LANGUAGES)[number];

export const SCENARIO_CALL_TYPES = ["fria", "discovery", "cierre"] as const;
export type ScenarioCallType = CallTypeOverlay;

export function isScenarioLanguage(value: string): value is ScenarioLanguage {
  return (SCENARIO_LANGUAGES as readonly string[]).includes(value);
}

export function isScenarioCallType(value: string): value is ScenarioCallType {
  return (SCENARIO_CALL_TYPES as readonly string[]).includes(value);
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
  /** Plain-language "good" for this beat. Scoring still uses the KLM-50 card. */
  whatGoodLooksLike?: string;
}

export type DimensionGuides = Partial<Record<ScoreDimensionId, string>>;

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
  /** ISO 639-1. Clinic presets and undeclared custom scenarios are Spanish. */
  language?: string;
  callType?: ScenarioCallType;
  dimensionGuides?: DimensionGuides;
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
  language: string;
  config: ScenarioConfig;
  /** Trainer voice-agent knobs; replay restores the same agent. */
  voiceAgent?: VoiceAgentSettings;
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
  language?: ScenarioLanguage;
  callType?: ScenarioCallType;
  rounds?: ScenarioRoundDef[];
  dimensionGuides?: DimensionGuides;
  traineeId?: string;
}

export interface UpdateCustomScenarioInput extends CreateCustomScenarioInput {
  slug: string;
}

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
