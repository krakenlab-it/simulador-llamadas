import {
  mergeClientLayerSettings,
  parseClientLayerSettings,
  type ClientLayerSettings,
} from "@/lib/agent/client-layer";
import { readStoredAgentSettings } from "@/lib/agent/storage";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";

function trainerLayerFromStorage(): ClientLayerSettings | null {
  if (typeof window === "undefined") return null;
  const harness = readStoredAgentSettings(window.localStorage);
  return harness.voiceAgent.clientLayer ?? null;
}

/** Merge IA guardrails from localStorage into the layer used on a live call. */
export function applyTrainerClientLayerGuards(
  layer?: ClientLayerSettings | null,
): ClientLayerSettings {
  const trainer = trainerLayerFromStorage();
  if (!trainer?.engineCopy) {
    return parseClientLayerSettings(layer);
  }
  return mergeClientLayerSettings(layer, trainer);
}

export function applyTrainerGuardsToVoiceAgent(
  voice: VoiceAgentSettings,
): VoiceAgentSettings {
  return {
    ...voice,
    clientLayer: applyTrainerClientLayerGuards(voice.clientLayer),
  };
}
