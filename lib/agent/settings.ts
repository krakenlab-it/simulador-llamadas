import {
  defaultScenarioCallType,
  defaultScenarioLanguage,
} from "@/lib/scenarios/authoring";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
} from "@/lib/voice/agent-settings";
import { defaultPromptForPreset, matchPresetByPrompt } from "./presets";
import {
  AGENT_TOOL_IDS,
  isAgentPresetId,
  isAgentProviderPreference,
  isAgentRuntime,
  isAgentToolId,
  type AgentHarnessSettings,
  type AgentPresetId,
  type AgentToolId,
  type AgentVisibilitySettings,
} from "./types";

export const DEFAULT_AGENT_VISIBILITY: AgentVisibilitySettings = {
  showSystemPrompt: true,
  showTools: false,
  showContext: false,
  showTraces: false,
  advancedOpen: false,
};

export const DEFAULT_AGENT_SETTINGS: AgentHarnessSettings = {
  presetId: "coach",
  systemPrompt: defaultPromptForPreset("coach"),
  runtime: "auto",
  providerPreference: "auto",
  temperature: 0.4,
  maxSteps: 4,
  language: defaultScenarioLanguage(),
  callType: defaultScenarioCallType(),
  difficultyLevel: 1,
  enabledTools: [...AGENT_TOOL_IDS],
  includeCatalog: true,
  includeDraft: true,
  includeVoiceSettings: true,
  includeTeams: true,
  visibility: { ...DEFAULT_AGENT_VISIBILITY },
  voiceAgent: { ...DEFAULT_VOICE_AGENT_SETTINGS },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseEnabledTools(value: unknown): AgentToolId[] {
  if (!Array.isArray(value)) return [...AGENT_TOOL_IDS];
  const tools = value.filter((item): item is AgentToolId => {
    return typeof item === "string" && isAgentToolId(item);
  });
  return tools.length > 0 ? tools : [...AGENT_TOOL_IDS];
}

export function parseAgentHarnessSettings(
  raw: unknown,
): AgentHarnessSettings {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const visibilityRaw =
    source.visibility && typeof source.visibility === "object"
      ? (source.visibility as Record<string, unknown>)
      : {};

  const language =
    source.language === "en" || source.language === "es"
      ? source.language
      : DEFAULT_AGENT_SETTINGS.language;
  const callType =
    source.callType === "fria" ||
    source.callType === "discovery" ||
    source.callType === "cierre"
      ? source.callType
      : DEFAULT_AGENT_SETTINGS.callType;
  const presetId = isAgentPresetId(String(source.presetId ?? ""))
    ? (source.presetId as AgentPresetId)
    : "coach";
  const systemPrompt =
    typeof source.systemPrompt === "string" && source.systemPrompt.trim()
      ? source.systemPrompt
      : defaultPromptForPreset(presetId);

  return {
    presetId,
    systemPrompt,
    runtime: isAgentRuntime(String(source.runtime ?? ""))
      ? (source.runtime as AgentHarnessSettings["runtime"])
      : "auto",
    providerPreference: isAgentProviderPreference(
      String(source.providerPreference ?? ""),
    )
      ? (source.providerPreference as AgentHarnessSettings["providerPreference"])
      : "auto",
    temperature: clamp(Number(source.temperature ?? 0.4) || 0.4, 0, 1.2),
    maxSteps: clamp(Math.round(Number(source.maxSteps ?? 4) || 4), 1, 8),
    language,
    callType,
    difficultyLevel: clamp(
      Math.round(Number(source.difficultyLevel ?? 1) || 1),
      1,
      3,
    ) as 1 | 2 | 3,
    enabledTools: parseEnabledTools(source.enabledTools),
    includeCatalog: asBoolean(source.includeCatalog, true),
    includeDraft: asBoolean(source.includeDraft, true),
    includeVoiceSettings: asBoolean(source.includeVoiceSettings, true),
    includeTeams: asBoolean(source.includeTeams, true),
    visibility: {
      showSystemPrompt: asBoolean(visibilityRaw.showSystemPrompt, true),
      showTools: asBoolean(visibilityRaw.showTools, false),
      showContext: asBoolean(visibilityRaw.showContext, false),
      showTraces: asBoolean(visibilityRaw.showTraces, false),
      advancedOpen: asBoolean(visibilityRaw.advancedOpen, false),
    },
    voiceAgent: parseVoiceAgentSettings(source.voiceAgent),
  };
}

export function applyPreset(
  settings: AgentHarnessSettings,
  presetId: AgentPresetId,
): AgentHarnessSettings {
  if (presetId === "custom") {
    return { ...settings, presetId: "custom" };
  }
  return {
    ...settings,
    presetId,
    systemPrompt: defaultPromptForPreset(presetId),
    callType: presetId === "cierre" ? "cierre" : settings.callType,
  };
}

export function applySystemPrompt(
  settings: AgentHarnessSettings,
  prompt: string,
): AgentHarnessSettings {
  return {
    ...settings,
    systemPrompt: prompt,
    presetId: matchPresetByPrompt(prompt),
  };
}
