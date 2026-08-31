/**
 * Database types aligned with supabase/migrations.
 * Regenerate from Supabase CLI in a later PR: `supabase gen types typescript`
 */

export type DifficultyLevel = 1 | 2 | 3;

export type PracticeMode = "voz" | "texto";

export type RoundType =
  | "apertura"
  | "objecion"
  | "claridad"
  | "correo"
  | "cierre";

export type CallStatus = "in_progress" | "completed" | "abandoned";

export const ROUND_ORDER: readonly RoundType[] = [
  "apertura",
  "objecion",
  "claridad",
  "correo",
  "cierre",
] as const;

export const SCORING_KEYWORDS = [
  "problema",
  "medicion",
  "jerga",
  "reconocimiento",
  "descalifica",
  "gratis",
  "reunion",
  "dia_hora",
  "monologo",
  "telegrama",
  "se_presenta_solo",
] as const;

export type ScoringKeyword = (typeof SCORING_KEYWORDS)[number];

export interface Trainee {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Scenario {
  id: string;
  slug: string;
  client_name: string;
  client_title: string;
  company_context: string;
  difficulty_label: string;
  indicator: string;
  pain_points: string[];
  sort_order: number;
  created_at: string;
}

export interface CallAttempt {
  id: string;
  trainee_id: string;
  scenario_id: string;
  difficulty_level: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  won: boolean | null;
  started_at: string;
  ended_at: string | null;
}

export interface CallTurn {
  id: string;
  call_attempt_id: string;
  round_number: number;
  round_type: RoundType;
  trainee_utterance: string | null;
  expected_phrase: string | null;
  created_at: string;
}

export interface TurnScore {
  id: string;
  turn_id: string;
  keyword_hits: Partial<Record<ScoringKeyword, boolean>>;
  round_score: number;
  feedback: string | null;
  created_at: string;
}

export interface CallHistoryEntry {
  call_attempt_id: string;
  trainee_id: string;
  scenario_slug: string;
  client_name: string;
  difficulty_level: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  won: boolean | null;
  total_score: number | null;
  started_at: string;
  ended_at: string | null;
}
