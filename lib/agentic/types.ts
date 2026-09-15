export type ToneId =
  | "molesto"
  | "intriga"
  | "desconfianza"
  | "prepotencia"
  | "suave"
  | "amigable";

export interface ToneProfile {
  id: ToneId;
  label: string;
  intensity: 1 | 2 | 3;
  stickiness: number;
  promptHint: string;
}

export type ScenarioPackSnippetSource = "field" | "context" | "round";

export interface ScenarioPackSnippet {
  id: string;
  text: string;
  source?: ScenarioPackSnippetSource;
}

export interface ScenarioPackMetadata {
  companyContext?: string;
  clientTitle?: string;
  clientName?: string;
}

export interface ScenarioPack {
  facts: string[];
  objections: string[];
  product: string;
  winCriteria: string;
  companyContext: string;
  clientTitle: string;
  industry: string;
  temperament: string;
  forbiddenClaims: string[];
  snippets: ScenarioPackSnippet[];
  contextText: string;
}

/** Runtime flags stored on ScenarioConfig for server-side reply generation. */
export interface AgenticRuntimeConfig {
  enabled: boolean;
  toneId?: ToneId;
  sessionSeed?: string;
  scenarioContextText?: string;
}

export interface TurnLogEntry {
  turnNumber: number;
  role: "trainee" | "client" | "coach";
  text: string;
  timestamp: string;
}

export type AgenticSimulationMode = "cliente" | "evaluador";

export interface EmotionalMeters {
  confianza: number;
  interes: number;
  paciencia: number;
}

export interface AgenticSessionState {
  callAttemptId: string;
  mode: AgenticSimulationMode;
  meters: EmotionalMeters;
  turnNumber: number;
}

/** Persisted per call_attempt for serverless-safe agentic sessions. */
export interface AgenticPersistence {
  state: AgenticSessionState;
  /** Number of raw transcript lines to skip after /reiniciar. */
  transcriptOffset: number;
}

export interface SessionMemory {
  sessionId: string;
  turns: TurnLogEntry[];
}

export interface GroundingResult {
  ok: boolean;
  reason?: string;
}

export interface ConversationTurn {
  role: "trainee" | "client";
  text: string;
}

export interface CharacterReplyInput {
  pack: ScenarioPack;
  config: import("@/lib/scenarios/types").ScenarioConfig;
  tone: ToneProfile;
  clientName: string;
  traineeUtterance: string;
  roundLabel: string;
  reaction: "bien" | "medio" | "mal";
  fallbackText: string;
  /** Recent trainee+client lines so the persona continues the live thread. */
  recentTurns?: ConversationTurn[];
  channel: import("@/lib/db/types").PracticeMode;
  difficultyLevel: import("@/lib/db/types").DifficultyLevel;
  maxTurns: number;
  turnNumber: number;
  callAttemptId: string;
  agenticState: AgenticSessionState;
  isCallEnding?: boolean;
  forceEvaluator?: boolean;
  /** When true, never silently fall back to template banks if LLM is missing or fails. */
  agenticRequired?: boolean;
}

export interface CharacterReplyResult {
  reply: string;
  grounded: boolean;
  usedLlm: boolean;
  evaluatorMode?: boolean;
  agenticError?: boolean;
}

export interface CoachNoteInput {
  pack: ScenarioPack;
  traineeUtterance: string;
  roundLabel: string;
  analyticsSummary: string;
}
