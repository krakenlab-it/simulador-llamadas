import type { DifficultyLevel } from "@/lib/db/types";
import {
  defaultScenarioCallType,
  defaultScenarioLanguage,
} from "@/lib/scenarios/authoring";
import {
  isScenarioCallType,
  isScenarioLanguage,
  type ScenarioCallType,
  type ScenarioLanguage,
} from "@/lib/scenarios/types";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
  type AgentLanguage,
} from "@/lib/voice/agent-settings";
import { AGENT_PRESETS, defaultPromptForPreset, matchPresetByPrompt } from "./presets";
import {
  AGENT_TOOL_IDS,
  isAgentPresetId,
  isAgentProviderPreference,
  isAgentRuntimeMode,
  isAgentToolId,
  type AgentHarnessSettings,
  type AgentPresetId,
  type AgentToolId,
  type AgentVisibilitySettings,
} from "./types";

const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 1.2;
const DEFAULT_TEMPERATURE = 0.4;
const MIN_STEPS = 1;
const MAX_STEPS = 8;
const DEFAULT_STEPS = 4;

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
  temperature: DEFAULT_TEMPERATURE,
  maxSteps: DEFAULT_STEPS,
  language: defaultScenarioLanguage(),
  callType: defaultScenarioCallType(),
  difficultyLevel: 1,
  enabledTools: [...AGENT_TOOL_IDS],
  includeCatalog: true,
  includeDraft: true,
  includeVoiceSettings: true,
  visibility: { ...DEFAULT_AGENT_VISIBILITY },
  voiceAgent: { ...DEFAULT_VOICE_AGENT_SETTINGS },
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function parseDifficulty(value: unknown): DifficultyLevel {
  if (value === 2 || value === 3) return value;
  if (value === "2" || value === "3") return Number(value) as DifficultyLevel;
  return 1;
}

function parseLanguage(value: unknown): ScenarioLanguage {
  return typeof value === "string" && isScenarioLanguage(value)
    ? value
    : defaultScenarioLanguage();
}

function parseCallType(value: unknown): ScenarioCallType {
  return typeof value === "string" && isScenarioCallType(value)
    ? value
    : defaultScenarioCallType();
}

function parseTools(value: unknown): AgentToolId[] {
  if (!Array.isArray(value)) return [...AGENT_TOOL_IDS];
  const unique = new Set<AgentToolId>();
  for (const item of value) {
    if (typeof item === "string" && isAgentToolId(item)) unique.add(item);
  }
  return unique.size > 0 ? [...unique] : [...AGENT_TOOL_IDS];
}

function parseVisibility(raw: unknown): AgentVisibilitySettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_AGENT_VISIBILITY };
  }
  const input = raw as Record<string, unknown>;
  return {
    showSystemPrompt: input.showSystemPrompt !== false,
    showTools: input.showTools === true,
    showContext: input.showContext === true,
    showTraces: input.showTraces === true,
    advancedOpen: input.advancedOpen === true,
  };
}

function parsePresetId(value: unknown): AgentPresetId {
  return typeof value === "string" && isAgentPresetId(value) ? value : "coach";
}

export function parseAgentHarnessSettings(raw: unknown): AgentHarnessSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_AGENT_SETTINGS, visibility: { ...DEFAULT_AGENT_VISIBILITY } };
  }

  const input = raw as Record<string, unknown>;
  const presetId = parsePresetId(input.presetId);
  const systemPrompt =
    typeof input.systemPrompt === "string"
      ? input.systemPrompt
      : defaultPromptForPreset(presetId);
  const language = parseLanguage(input.language);
  const voiceAgent = parseVoiceAgentSettings(input.voiceAgent);
  const voiceLanguage: AgentLanguage = language === "en" ? "en" : "es";
  const syncedVoice = {
    ...voiceAgent,
    language: voiceLanguage,
    difficultyLevel: parseDifficulty(
      input.difficultyLevel ?? voiceAgent.difficultyLevel,
    ),
  };

  return {
    presetId,
    systemPrompt,
    runtime:
      typeof input.runtime === "string" && isAgentRuntimeMode(input.runtime)
        ? input.runtime
        : "auto",
    providerPreference:
      typeof input.providerPreference === "string" &&
      isAgentProviderPreference(input.providerPreference)
        ? input.providerPreference
        : "auto",
    temperature: clampNumber(
      typeof input.temperature === "number"
        ? input.temperature
        : Number(input.temperature),
      MIN_TEMPERATURE,
      MAX_TEMPERATURE,
      DEFAULT_TEMPERATURE,
    ),
    maxSteps: Math.round(
      clampNumber(
        typeof input.maxSteps === "number" ? input.maxSteps : Number(input.maxSteps),
        MIN_STEPS,
        MAX_STEPS,
        DEFAULT_STEPS,
      ),
    ),
    language,
    callType: parseCallType(input.callType),
    difficultyLevel: syncedVoice.difficultyLevel,
    enabledTools: parseTools(input.enabledTools),
    includeCatalog: input.includeCatalog !== false,
    includeDraft: input.includeDraft !== false,
    includeVoiceSettings: input.includeVoiceSettings !== false,
    visibility: parseVisibility(input.visibility),
    voiceAgent: syncedVoice,
  };
}

export function applyPreset(
  settings: AgentHarnessSettings,
  presetId: AgentPresetId,
): AgentHarnessSettings {
  if (presetId === "custom") {
    return { ...settings, presetId: "custom" };
  }
  const preset = AGENT_PRESETS.find((item) => item.id === presetId);
  if (!preset) return settings;
  return parseAgentHarnessSettings({
    ...settings,
    presetId,
    systemPrompt: preset.systemPrompt,
    callType: presetId === "cierre" ? "cierre" : settings.callType,
  });
}

export function applySystemPrompt(
  settings: AgentHarnessSettings,
  systemPrompt: string,
): AgentHarnessSettings {
  return parseAgentHarnessSettings({
    ...settings,
    systemPrompt,
    presetId: systemPrompt.trim()
      ? matchPresetByPrompt(systemPrompt)
      : "custom",
  });
}

export function settingsCatalogPayload(settings: AgentHarnessSettings): AgentHarnessSettings {
  return parseAgentHarnessSettings(settings);
}
