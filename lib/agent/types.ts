import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import type {
  CreateCustomScenarioInput,
  ScenarioCallType,
  ScenarioLanguage,
} from "@/lib/scenarios/types";
import type { DifficultyLevel } from "@/lib/db/types";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";

/** Hard channels. Never mix these in one blob. */
export const HARNESS_ROLES = ["agent", "user", "context"] as const;
export type HarnessRole = (typeof HARNESS_ROLES)[number];

export const HARNESS_STATES = [
  "idle",
  "gathering",
  "proposing",
  "ready",
  "comparing",
] as const;
export type HarnessState = (typeof HARNESS_STATES)[number];

export const AGENT_PRESET_IDS = [
  "coach",
  "esceptico",
  "cierre",
  "custom",
] as const;
export type AgentPresetId = (typeof AGENT_PRESET_IDS)[number];

export const AGENT_RUNTIMES = ["auto", "ai-sdk", "local"] as const;
export type AgentRuntimeMode = (typeof AGENT_RUNTIMES)[number];

export const AGENT_PROVIDER_PREFERENCES = [
  "auto",
  "deepseek",
  "groq",
  "gemini",
] as const;
export type AgentProviderPreference = (typeof AGENT_PROVIDER_PREFERENCES)[number];

export const AGENT_RESOLVED_PROVIDERS = [
  "deepseek",
  "groq",
  "gemini",
  "local",
] as const;
export type AgentResolvedProvider = (typeof AGENT_RESOLVED_PROVIDERS)[number];

export const AGENT_RESOLVED_RUNTIMES = ["ai-sdk", "local"] as const;
export type AgentResolvedRuntime = (typeof AGENT_RESOLVED_RUNTIMES)[number];

export const AGENT_TOOL_IDS = [
  "list_catalog",
  "propose_scenario",
  "patch_draft",
  "apply_scenario",
  "reset_draft",
  "list_teams",
  "compare_team_test",
] as const;
export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

export interface AgentVisibilitySettings {
  showSystemPrompt: boolean;
  showTools: boolean;
  showContext: boolean;
  showTraces: boolean;
  advancedOpen: boolean;
}

export interface AgentHarnessSettings {
  presetId: AgentPresetId;
  systemPrompt: string;
  runtime: AgentRuntimeMode;
  providerPreference: AgentProviderPreference;
  temperature: number;
  maxSteps: number;
  language: ScenarioLanguage;
  callType: ScenarioCallType;
  difficultyLevel: DifficultyLevel;
  enabledTools: AgentToolId[];
  includeCatalog: boolean;
  includeDraft: boolean;
  includeVoiceSettings: boolean;
  includeTeams: boolean;
  visibility: AgentVisibilitySettings;
  voiceAgent: VoiceAgentSettings;
}

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PublicScenarioSummary {
  slug: string;
  clientName: string;
  clientTitle: string;
  industry: string;
  isPreset: boolean;
}

export interface AgentChatRequest {
  messages: AgentChatMessage[];
  settings: AgentHarnessSettings;
  catalog: PublicScenarioSummary[];
  draft: ScenarioAuthoringDraft | null;
  teamId?: string | null;
  testId?: string | null;
}

export interface AgentToolTrace {
  toolId: AgentToolId;
  ok: boolean;
  summary: string;
}

export interface AgentChatResponse {
  assistantMessage: AgentChatMessage;
  draft: ScenarioAuthoringDraft | null;
  traces: AgentToolTrace[];
  runtime: AgentResolvedRuntime;
  provider: AgentResolvedProvider;
  state: HarnessState;
  roles: Record<HarnessRole, string>;
  systemPromptUsed: string;
  contextPack: string;
  appliedInput: CreateCustomScenarioInput | null;
  comparison: TeamComparisonView | null;
}

export interface AgentToolSession {
  draft: ScenarioAuthoringDraft | null;
  catalog: PublicScenarioSummary[];
  settings: AgentHarnessSettings;
  appliedInput: CreateCustomScenarioInput | null;
  comparison: TeamComparisonView | null;
  teamId: string | null;
  testId: string | null;
}

export interface AgentProviderAvailability {
  deepseek: boolean;
  groq: boolean;
  gemini: boolean;
  gateway: boolean;
  hasModel: boolean;
}

export interface TeamComparisonMemberView {
  memberId: string;
  displayName: string;
  totalScore: number;
  won: boolean;
  turnsCompleted: number;
}

export interface TeamComparisonView {
  teamId: string;
  teamName: string;
  testId: string;
  scenarioSlug: string;
  title: string;
  members: TeamComparisonMemberView[];
  leaderName: string | null;
  gaps: string[];
  coaching: string[];
  narrative: string;
}

export function isAgentPresetId(value: string): value is AgentPresetId {
  return (AGENT_PRESET_IDS as readonly string[]).includes(value);
}

export function isAgentRuntime(value: string): value is AgentRuntimeMode {
  return (AGENT_RUNTIMES as readonly string[]).includes(value);
}

export function isAgentProviderPreference(
  value: string,
): value is AgentProviderPreference {
  return (AGENT_PROVIDER_PREFERENCES as readonly string[]).includes(value);
}

export function isAgentToolId(value: string): value is AgentToolId {
  return (AGENT_TOOL_IDS as readonly string[]).includes(value);
}

export function summarizeScenario(input: {
  slug: string;
  clientName: string;
  clientTitle?: string | null;
  industry?: string | null;
  isPreset: boolean;
}): PublicScenarioSummary {
  return {
    slug: input.slug,
    clientName: input.clientName,
    clientTitle: input.clientTitle ?? "",
    industry: input.industry ?? "",
    isPreset: input.isPreset,
  };
}
