import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import {
  generateClientReply,
  generateGroqClientReply,
  isGroqAvailable,
} from "@/lib/llm/client-replies";
import { templateClientReply } from "@/lib/feedback/evaluation";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { getClientReply } from "@/lib/scoring/reactions";
import { isClinicPreset } from "@/lib/scenarios/types";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { computeTurnAnalytics } from "./analytics";
import type { CallAnalytics, TranscriptLine } from "./types";
import type { ClientReaction } from "./rondas";

export interface LiveTurnInput {
  utterance: string;
  roundKey: string;
  roundLabel: string;
  roundGoal: string;
  difficultyLevel: DifficultyLevel;
  scenarioSlug: string;
  isPreset: boolean;
  config: ScenarioConfig | null;
  clientName: string;
  isLastRound: boolean;
  priorLines: TranscriptLine[];
}

export interface LiveTurnCoaching {
  note: string;
  analytics: CallAnalytics;
}

export interface LiveTurnResult {
  analytics: CallAnalytics;
  coaching: LiveTurnCoaching;
  clientReaction: ClientReaction;
  clientReply: string;
  /** Interim engagement score 0-100 for storage; not keyword-derived. */
  engagementScore: number;
  won: boolean;
}

const ROUND_LABELS: Record<string, string> = {
  apertura: "Apertura",
  objecion: "Objeción",
  claridad: "Claridad",
  correo: "Correo",
  cierre: "Cierre",
};

function reactionFromAnalytics(analytics: CallAnalytics, utterance: string): ClientReaction {
  const trimmed = utterance.trim();
  if (trimmed.length < 12) return "mal";
  if (analytics.questionTypes.open + analytics.questionTypes.clarifying >= 1) return "bien";
  if (analytics.talkPercent > 85) return "mal";
  if (trimmed.length > 80) return "medio";
  return "medio";
}

function engagementScore(analytics: CallAnalytics, utterance: string): number {
  let score = 45;
  score += Math.min(20, analytics.questionTypes.open * 8);
  score += Math.min(12, analytics.questionTypes.clarifying * 6);
  if (analytics.hasNextStep) score += 15;
  if (utterance.trim().length < 20) score -= 20;
  if (analytics.talkPercent > 80) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildCoachingNote(
  analytics: CallAnalytics,
  roundLabel: string,
  utterance: string,
): string {
  if (utterance.trim().length < 15) {
    return `${roundLabel}: tu turno fue muy corto; amplía con una pregunta abierta.`;
  }
  if (analytics.talkPercent > 80) {
    return `${roundLabel}: hablaste ${analytics.talkPercent}% del tiempo; deja más espacio al cliente.`;
  }
  if (analytics.questionTypes.open === 0) {
    return `${roundLabel}: prueba una pregunta abierta antes de proponer solución.`;
  }
  if (analytics.hasNextStep) {
    return `${roundLabel}: buen avance hacia un siguiente paso concreto.`;
  }
  return `${roundLabel}: escucha activa; profundiza en el impacto del problema.`;
}

export async function scoreLiveTurn(input: LiveTurnInput): Promise<LiveTurnResult> {
  const analytics = computeTurnAnalytics({
    utterance: input.utterance,
    priorLines: input.priorLines,
  });

  const clientReaction = reactionFromAnalytics(analytics, input.utterance);
  const coachingNote = buildCoachingNote(
    analytics,
    input.roundLabel,
    input.utterance,
  );

  let clientReply: string;

  if (input.isPreset && isClinicPreset(input.scenarioSlug)) {
    const roundType = input.roundKey as Parameters<typeof getClientReply>[1];
    const templatedReply = getClientReply(
      input.scenarioSlug,
      roundType,
      clientReaction,
    );

    clientReply = templatedReply;
    if (isGroqAvailable()) {
      const presetConfig = buildPresetScenarioConfig(input.scenarioSlug);
      if (presetConfig) {
        const roundDef: ScenarioRoundDef = {
          key: input.roundKey,
          label: ROUND_LABELS[input.roundKey] ?? input.roundLabel,
          goal: ROUND_EXPECTED[roundType],
          clientPrompt: templatedReply,
          positiveCriteria: [],
          negativeCriteria: [],
        };
        clientReply = await generateGroqClientReply(
          {
            config: presetConfig,
            round: roundDef,
            reaction: clientReaction,
            clientName: input.clientName,
            traineeUtterance: input.utterance,
            roundNumber: 0,
          },
          templatedReply,
        );
      }
    }
  } else if (input.config) {
    const round: ScenarioRoundDef =
      input.config.rounds.find((r) => r.key === input.roundKey) ?? {
        key: input.roundKey,
        label: input.roundLabel,
        goal: input.roundGoal,
        clientPrompt: input.roundGoal,
        positiveCriteria: [],
        negativeCriteria: [],
      };

    clientReply = await generateClientReply({
      config: input.config,
      round,
      reaction: clientReaction,
      clientName: input.clientName,
      traineeUtterance: input.utterance,
      roundNumber: 0,
    });
  } else {
    clientReply = "Entiendo. Siga.";
  }

  if (!clientReply) {
    clientReply = input.config
      ? templateClientReply(
          input.config,
          input.config.rounds[0],
          clientReaction,
          input.clientName,
        )
      : "Entiendo.";
  }

  return {
    analytics,
    coaching: { note: coachingNote, analytics },
    clientReaction,
    clientReply,
    engagementScore: engagementScore(analytics, input.utterance),
    won: false,
  };
}
