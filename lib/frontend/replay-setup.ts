import type { SetupConfig } from "@/app/components/training/ScenarioHub";
import type { SessionDetail } from "@/lib/api/stubs";
import {
  openingLineForCall,
  phaseLabelsForCall,
} from "@/lib/scenarios/authoring";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
} from "@/lib/voice/agent-settings";

export function replaySetupFromDetail(detail: SessionDetail): SetupConfig {
  const voiceAgent = parseVoiceAgentSettings(
    detail.voiceAgent ?? DEFAULT_VOICE_AGENT_SETTINGS,
  );

  return {
    scenarioSlug: detail.scenarioSlug,
    clientName: detail.clientName,
    isPreset: detail.isPreset,
    mode: detail.mode,
    difficultyLevel: detail.difficultyLevel,
    totalRounds: detail.totalRounds,
    phaseLabels: phaseLabelsForCall(detail.config ?? null, detail.isPreset),
    voiceAgent,
    openingLine: openingLineForCall(detail.config ?? null, detail.isPreset),
  };
}
