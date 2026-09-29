import type { SetupConfig } from "@/app/components/training/ScenarioHub";
import type { SessionDetail } from "@/lib/api/stubs";
import { getClientBySlug } from "@/lib/clients";
import { getClientLine } from "@/lib/simulation/rounds";
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

  const presetClient = detail.isPreset
    ? getClientBySlug(detail.scenarioSlug)
    : undefined;
  const presetOpening =
    presetClient ? getClientLine(presetClient, 0) : undefined;

  return {
    scenarioSlug: detail.scenarioSlug,
    clientName: detail.clientName,
    isPreset: detail.isPreset,
    mode: detail.mode,
    difficultyLevel: detail.difficultyLevel,
    totalRounds: detail.totalRounds,
    phaseLabels: phaseLabelsForCall(detail.config ?? null, detail.isPreset),
    voiceAgent,
    openingLine: openingLineForCall(
      detail.config ?? null,
      detail.isPreset,
      presetOpening,
    ),
  };
}
