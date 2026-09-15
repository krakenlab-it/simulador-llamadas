import type { DifficultyLevel, RoundType } from "@/lib/db/types";
import type { RichTurnFeedback, ScenarioConfig } from "@/lib/scenarios/types";
import { utteranceHasDay, utteranceHasTime } from "@/lib/scoring/keywords";
import { scoreLiveTurn, type LiveTurnInput } from "./live-turn";
import type { CallAnalytics, TranscriptLine } from "./types";
import type { ClientReaction } from "./rondas";
import type { VoiceAgentSettings } from "@/lib/voice/agent-settings";

export interface AdaptiveScoreInput {
  utterance: string;
  roundKey: string;
  roundType?: RoundType | null;
  roundLabel: string;
  roundGoal: string;
  difficultyLevel: DifficultyLevel;
  scenarioSlug: string;
  isPreset: boolean;
  config: ScenarioConfig | null;
  clientName: string;
  isLastRound: boolean;
  /** 1-based call turn (1–10). Overflow cierre is 6–10. */
  roundNumber?: number;
  /** Per-call seed for varied dialogue (typically callAttemptId). */
  sessionSeed?: string;
  priorLines?: TranscriptLine[];
  voiceAgent?: VoiceAgentSettings;
}

export interface AdaptiveScoreResult {
  analytics: CallAnalytics;
  hasDay: boolean;
  hasTime: boolean;
  roundScore: number;
  feedback: string;
  clientReaction: ClientReaction;
  clientReply: string;
  hasConcreteDayAndTime: boolean;
  won: boolean;
  richFeedback: RichTurnFeedback;
}

function detectDayTime(utterance: string): { hasDay: boolean; hasTime: boolean } {
  return {
    hasDay: utteranceHasDay(utterance),
    hasTime: utteranceHasTime(utterance),
  };
}

export async function scoreTurnAdaptive(
  input: AdaptiveScoreInput,
): Promise<AdaptiveScoreResult> {
  const liveInput: LiveTurnInput = {
    ...input,
    priorLines: input.priorLines ?? [],
  };

  const live = await scoreLiveTurn(liveInput);
  const { hasDay, hasTime } = detectDayTime(input.utterance);

  const richFeedback: RichTurnFeedback = {
    score: live.engagementScore,
    utterance: input.utterance,
    whyScore: live.coaching.note,
    strongerLine: "",
    missedCriteria: [],
    roundLabel: input.roundLabel,
    analytics: live.analytics,
  };

  return {
    analytics: live.analytics,
    hasDay,
    hasTime,
    roundScore: live.engagementScore,
    feedback: input.roundGoal || live.coaching.note,
    clientReaction: live.clientReaction,
    clientReply: live.clientReply,
    hasConcreteDayAndTime: hasDay && hasTime,
    won: live.won,
    richFeedback,
  };
}
