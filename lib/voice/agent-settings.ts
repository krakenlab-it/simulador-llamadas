import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioRecord } from "@/lib/scenarios/types";

/**
 * Documented ElevenLabs premade/default voices (category premade,
 * free_users_allowed). Library voices return 402 on the free plan — never
 * offer those here.
 *
 * Sarah is the same fallback already used by billed TTS.
 * @see https://elevenlabs.io/docs/overview/capabilities/voices
 */
export const PREMADE_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "female" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", gender: "neutral" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female" },
] as const;

export type PremadeVoiceId = (typeof PREMADE_VOICES)[number]["id"];

export type AgentLanguage = "es" | "en";
export type SpeakingRatePreset = "lento" | "normal" | "rapido";
export type AgentPersonality =
  | "paciente"
  | "neutral"
  | "esceptico"
  | "impaciente";

export interface VoiceAgentSettings {
  language: AgentLanguage;
  voiceId: string;
  speakingRate: SpeakingRatePreset;
  personality: AgentPersonality;
  difficultyLevel: DifficultyLevel;
  bargeIn: boolean;
  /** Trainer opened the Advanced voice knobs; persist so a call does not reset it. */
  advancedOpen: boolean;
}

export const DEFAULT_PREMADE_VOICE_ID: PremadeVoiceId = "EXAVITQu4vr4xnSDxMaL";

export const DEFAULT_VOICE_AGENT_SETTINGS: VoiceAgentSettings = {
  language: "es",
  voiceId: DEFAULT_PREMADE_VOICE_ID,
  speakingRate: "normal",
  personality: "neutral",
  difficultyLevel: 1,
  bargeIn: false,
  advancedOpen: false,
};

const PREMADE_VOICE_IDS = new Set<string>(PREMADE_VOICES.map((voice) => voice.id));

const SPEAKING_RATE_VALUES: Record<SpeakingRatePreset, number> = {
  lento: 0.85,
  normal: 1,
  rapido: 1.15,
};

const PERSONALITY_HINTS: Record<AgentPersonality, string> = {
  paciente: "Paciente, escucha antes de cortar",
  neutral: "Directo, profesional",
  esceptico: "Escéptico",
  impaciente: "Impaciente, poco tiempo",
};

const MIN_SPEAKING_RATE = 0.7;
const MAX_SPEAKING_RATE = 1.2;

export function isPremadeVoiceId(voiceId: string): boolean {
  return PREMADE_VOICE_IDS.has(voiceId);
}

export function resolvePremadeVoiceId(voiceId: string | undefined | null): string {
  if (voiceId && isPremadeVoiceId(voiceId)) return voiceId;
  return DEFAULT_PREMADE_VOICE_ID;
}

export function speakingRateToNumber(preset: SpeakingRatePreset): number {
  switch (preset) {
    case "lento":
    case "normal":
    case "rapido":
      return SPEAKING_RATE_VALUES[preset];
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function clampSpeakingRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(MAX_SPEAKING_RATE, Math.max(MIN_SPEAKING_RATE, rate));
}

export function temperamentWithPersonality(
  base: string,
  personality: AgentPersonality,
): string {
  const hint = personalityHint(personality);
  if (!base.trim()) return hint;
  if (base.toLowerCase().includes(hint.toLowerCase())) return base;
  return `${base}. ${hint}`;
}

export function personalityHint(personality: AgentPersonality): string {
  switch (personality) {
    case "paciente":
    case "neutral":
    case "esceptico":
    case "impaciente":
      return PERSONALITY_HINTS[personality];
    default: {
      const _exhaustive: never = personality;
      return _exhaustive;
    }
  }
}

function parseLanguage(value: unknown): AgentLanguage {
  return value === "en" ? "en" : "es";
}

function parseSpeakingRate(value: unknown): SpeakingRatePreset {
  if (value === "lento" || value === "rapido" || value === "normal") return value;
  return "normal";
}

function parsePersonality(value: unknown): AgentPersonality {
  if (
    value === "paciente" ||
    value === "neutral" ||
    value === "esceptico" ||
    value === "impaciente"
  ) {
    return value;
  }
  return "neutral";
}

function parseDifficulty(value: unknown): DifficultyLevel {
  if (value === 2 || value === 3) return value;
  if (value === "2" || value === "3") return Number(value) as DifficultyLevel;
  return 1;
}

export function parseVoiceAgentSettings(raw: unknown): VoiceAgentSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VOICE_AGENT_SETTINGS };
  }
  const input = raw as Record<string, unknown>;
  return {
    language: parseLanguage(input.language),
    voiceId: resolvePremadeVoiceId(
      typeof input.voiceId === "string" ? input.voiceId : null,
    ),
    speakingRate: parseSpeakingRate(input.speakingRate),
    personality: parsePersonality(input.personality),
    difficultyLevel: parseDifficulty(input.difficultyLevel),
    bargeIn: input.bargeIn === true,
    advancedOpen: input.advancedOpen === true,
  };
}

export function voiceAgentFromRecord(
  record: Pick<ScenarioRecord, "voiceAgent"> | null | undefined,
): VoiceAgentSettings {
  return parseVoiceAgentSettings(record?.voiceAgent);
}

export function applyVoiceAgentToRecord(
  record: ScenarioRecord,
  settings: VoiceAgentSettings,
): ScenarioRecord {
  return {
    ...record,
    voiceAgent: parseVoiceAgentSettings(settings),
  };
}

export function voiceAgentToTtsOptions(settings: VoiceAgentSettings): {
  voiceId: string;
  language: AgentLanguage;
  speakingRate: number;
} {
  return {
    voiceId: resolvePremadeVoiceId(settings.voiceId),
    language: settings.language,
    speakingRate: clampSpeakingRate(speakingRateToNumber(settings.speakingRate)),
  };
}
