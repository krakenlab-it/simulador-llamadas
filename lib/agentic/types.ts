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

export interface ScenarioPackSnippet {
  id: string;
  text: string;
  source?: string;
}

export interface ScenarioPack {
  facts: string[];
  objections: string[];
  product: string;
  winCriteria: string;
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

export interface SessionMemory {
  sessionId: string;
  turns: TurnLogEntry[];
}

export interface GroundingResult {
  ok: boolean;
  reason?: string;
}

export interface CharacterReplyInput {
  pack: ScenarioPack;
  tone: ToneProfile;
  clientName: string;
  traineeUtterance: string;
  roundLabel: string;
  reaction: "bien" | "medio" | "mal";
  fallbackText: string;
}

export interface CharacterReplyResult {
  reply: string;
  grounded: boolean;
  usedLlm: boolean;
}

export interface CoachNoteInput {
  pack: ScenarioPack;
  traineeUtterance: string;
  roundLabel: string;
  analyticsSummary: string;
}
