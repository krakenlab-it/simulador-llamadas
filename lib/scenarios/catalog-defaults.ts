import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
import type { ClinicPresetSlug, ScenarioRecord } from "@/lib/scenarios/types";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
  type AgentPersonality,
  type VoiceAgentSettings,
} from "@/lib/voice/agent-settings";

/**
 * First-open knobs for a catalog client. Lives here (not in catalog-presets)
 * so the catalog SoT does not import voice-agent settings.
 *
 * Spanish + Según personaje + Cliente en vivo ON + tono Según personaje.
 * Personality follows the buyer so stock defaults are not a generic stub.
 */
export function catalogPersonalityForSlug(slug: string): AgentPersonality {
  const preset = getCatalogPreset(slug);
  if (!preset) return DEFAULT_VOICE_AGENT_SETTINGS.personality;
  return personalityForClinicSlug(preset.slug);
}

function personalityForClinicSlug(slug: ClinicPresetSlug): AgentPersonality {
  switch (slug) {
    case "mariana":
      return "esceptico";
    case "rodrigo":
      return "impaciente";
    case "efrain":
      return "esceptico";
    default: {
      const _exhaustive: never = slug;
      return _exhaustive;
    }
  }
}

export function catalogSetupDefaults(slug: string): VoiceAgentSettings {
  return {
    ...DEFAULT_VOICE_AGENT_SETTINGS,
    language: "es",
    voiceGender: "auto",
    personality: catalogPersonalityForSlug(slug),
    clientLayer: { motorEnabled: true, toneId: "auto" },
  };
}

/** True when the record still has factory knobs — not a trainer override. */
export function looksLikeStockVoiceDefaults(
  settings: VoiceAgentSettings,
): boolean {
  return (
    settings.language === DEFAULT_VOICE_AGENT_SETTINGS.language &&
    settings.voiceGender === DEFAULT_VOICE_AGENT_SETTINGS.voiceGender &&
    settings.voiceId === DEFAULT_VOICE_AGENT_SETTINGS.voiceId &&
    settings.voiceOverride === DEFAULT_VOICE_AGENT_SETTINGS.voiceOverride &&
    settings.speakingRate === DEFAULT_VOICE_AGENT_SETTINGS.speakingRate &&
    settings.personality === DEFAULT_VOICE_AGENT_SETTINGS.personality &&
    settings.difficultyLevel === DEFAULT_VOICE_AGENT_SETTINGS.difficultyLevel &&
    settings.bargeIn === DEFAULT_VOICE_AGENT_SETTINGS.bargeIn &&
    settings.advancedOpen === DEFAULT_VOICE_AGENT_SETTINGS.advancedOpen &&
    settings.clientLayer.motorEnabled === true &&
    settings.clientLayer.toneId === "auto"
  );
}

export function resolveHubVoiceAgent(
  record: Pick<ScenarioRecord, "slug" | "isPreset" | "voiceAgent">,
): VoiceAgentSettings {
  const parsed = parseVoiceAgentSettings(record.voiceAgent);
  if (record.isPreset && looksLikeStockVoiceDefaults(parsed)) {
    return catalogSetupDefaults(record.slug);
  }
  return parsed;
}
