import type { DifficultyLevel, RoundType } from "@/lib/db/types";
import type { RichTurnFeedback, ScenarioConfig } from "@/lib/scenarios/types";
import { scoreLiveTurn, type LiveTurnInput } from "./live-turn";
import type { CallAnalytics, TranscriptLine } from "./types";
import type { ClientReaction } from "./rondas";

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
  priorLines?: TranscriptLine[];
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
  const hasDay =
    /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+de)/i.test(
      utterance,
    );
  const hasTime = /\d{1,2}[:h]\d{2}|\d{1,2}\s*(am|pm|hrs?)/i.test(utterance);
  return { hasDay, hasTime };
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
    strongerLine: live.coaching.note,
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
