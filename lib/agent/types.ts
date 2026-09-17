import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import type {
  CreateCustomScenarioInput,
  ScenarioCallType,
  ScenarioLanguage,
} from "@/lib/scenarios/types";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";

export const AGENT_PRESET_IDS = [
  "coach",
  "esceptico",
  "cierre",
  "custom",
] as const;
export type AgentPresetId = (typeof AGENT_PRESET_IDS)[number];

export const AGENT_RUNTIMES = ["auto", "ai-sdk", "local"] as const;
export type AgentRuntimeMode = (typeof AGENT_RUNTIMES)[number];

export const AGENT_PROVIDER_PREFERENCES = ["auto", "groq", "gemini"] as const;
export type AgentProviderPreference =
  (typeof AGENT_PROVIDER_PREFERENCES)[number];

export const AGENT_TOOL_IDS = [
  "list_catalog",
  "propose_scenario",
  "patch_draft",
  "apply_scenario",
  "reset_draft",
] as const;
export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

export type AgentResolvedRuntime = "ai-sdk" | "local";
export type AgentResolvedProvider = "groq" | "gemini" | "local";

export interface AgentVisibilitySettings {
  /** Always on for the happy path — the prompt is the main experiment knob. */
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
  visibility: AgentVisibilitySettings;
  voiceAgent: VoiceAgentSettings;
}

export interface AgentPreset {
  id: Exclude<AgentPresetId, "custom">;
  label: string;
  description: string;
  systemPrompt: string;
}

export interface PublicScenarioSummary {
  slug: string;
  clientName: string;
  clientTitle: string;
  industry: string | null;
  isPreset: boolean;
  language: string;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AgentToolTrace {
  toolId: AgentToolId;
  input: unknown;
  output: unknown;
}

export interface AgentChatRequest {
  messages: AgentChatMessage[];
  settings: AgentHarnessSettings;
  catalog: PublicScenarioSummary[];
  draft: ScenarioAuthoringDraft | null;
}

export interface AgentChatResponse {
  assistantMessage: AgentChatMessage;
  draft: ScenarioAuthoringDraft | null;
  traces: AgentToolTrace[];
  runtime: AgentResolvedRuntime;
  provider: AgentResolvedProvider;
  systemPromptUsed: string;
  contextPack: string;
  appliedInput: CreateCustomScenarioInput | null;
}

export interface AgentProviderAvailability {
  groq: boolean;
  gemini: boolean;
  gateway: boolean;
}

export interface AgentHarnessCatalog {
  defaultSettings: AgentHarnessSettings;
  presets: AgentPreset[];
  tools: Array<{
    id: AgentToolId;
    label: string;
    description: string;
  }>;
  availability: AgentProviderAvailability;
  envNames: string[];
}

export interface AgentToolSession {
  draft: ScenarioAuthoringDraft | null;
  catalog: PublicScenarioSummary[];
  settings: AgentHarnessSettings;
  appliedInput: CreateCustomScenarioInput | null;
}

export function isAgentPresetId(value: string): value is AgentPresetId {
  return (AGENT_PRESET_IDS as readonly string[]).includes(value);
}

export function isAgentRuntimeMode(value: string): value is AgentRuntimeMode {
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

export function summarizeScenario(record: {
  slug: string;
  clientName: string;
  clientTitle: string;
  industry: string | null;
  isPreset: boolean;
  language: string;
}): PublicScenarioSummary {
  return {
    slug: record.slug,
    clientName: record.clientName,
    clientTitle: record.clientTitle,
    industry: record.industry,
    isPreset: record.isPreset,
    language: record.language,
  };
}
