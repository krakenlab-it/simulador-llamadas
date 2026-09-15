import type { DifficultyLevel, RoundType } from "@/lib/db/types";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import {
  temperamentWithPersonality,
  type VoiceAgentSettings,
} from "@/lib/voice/agent-settings";
import {
  generateClientReply,
  generateGroqClientReply,
  isGroqAvailable,
} from "@/lib/llm/client-replies";
import {
  buildScenarioPack,
  generateCharacterReply,
  generateCoachNote,
  getToneById,
  isAgenticSessionActive,
  pickTone,
  resolveAgenticSeed,
} from "@/lib/agentic";
import {
  getAgenticSessionState,
  resetAgenticSessionState,
  saveAgenticSessionState,
} from "@/lib/agentic/agentic-session-store";
import { updateEmotionalMeters, shouldHangUpForPatience } from "@/lib/agentic/emotional-meters";
import type { PracticeMode } from "@/lib/db/types";
import { SESSION_MAX_TURN_ALLOCATIONS } from "@/lib/voice/brakes";
import { templateClientReply } from "@/lib/feedback/evaluation";
import { getClientBySlug } from "@/lib/clients";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { isClinicRoundType, phaseKeyFromPersistenceKey } from "@/lib/simulation/round-keys";
import { utteranceHasConcreteDayAndTime } from "@/lib/scoring/keywords";
import { getClientReply } from "@/lib/scoring/reactions";
import { isClinicPreset } from "@/lib/scenarios/types";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import type { ConversationTurn } from "@/lib/agentic/types";
import { enrichPriorTranscriptLines } from "./transcript";
import { computeTurnAnalytics } from "./analytics";
import type { CallAnalytics, TranscriptLine } from "./types";
import type { ClientReaction } from "./rondas";

export interface LiveTurnInput {
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
  priorLines: TranscriptLine[];
  voiceAgent?: VoiceAgentSettings;
  mode?: PracticeMode;
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

function applyVoiceAgentPersonality(
  config: ScenarioConfig | null,
  voiceAgent?: VoiceAgentSettings,
): ScenarioConfig | null {
  if (!config || !voiceAgent) return config;
  return {
    ...config,
    temperament: temperamentWithPersonality(
      config.temperament,
      voiceAgent.personality,
    ),
  };
}

const ROUND_LABELS: Record<string, string> = {
  apertura: "Apertura",
  objecion: "Objeción",
  claridad: "Claridad",
  correo: "Correo",
  cierre: "Cierre",
};

function isCierreLikeRound(input: LiveTurnInput): boolean {
  const roundType = resolveScoringRoundType(input);
  if (roundType === "cierre") return true;
  return input.isLastRound && !input.isPreset;
}

function reactionFromAnalytics(
  analytics: CallAnalytics,
  utterance: string,
  input: LiveTurnInput,
): ClientReaction {
  const trimmed = utterance.trim();
  if (trimmed.length < 12) return "mal";
  if (
    isCierreLikeRound(input) &&
    utteranceHasConcreteDayAndTime(trimmed)
  ) {
    return "bien";
  }
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

function resolveTurnNumber(input: LiveTurnInput): number {
  if (typeof input.roundNumber === "number" && input.roundNumber > 0) {
    return input.roundNumber;
  }
  const match = /-(\d+)$/.exec(input.roundKey);
  if (match) return Number(match[1]);
  return 0;
}

function resolveScoringRoundType(input: LiveTurnInput): RoundType | null {
  if (input.roundType) return input.roundType;
  const phaseKey = phaseKeyFromPersistenceKey(input.roundKey);
  return isClinicRoundType(phaseKey) ? phaseKey : null;
}

function resolveSessionSeed(input: LiveTurnInput): string {
  return (
    input.sessionSeed?.trim() ||
    input.config?.agentic?.sessionSeed?.trim() ||
    input.scenarioSlug
  );
}

function resolvePriorLines(input: LiveTurnInput): TranscriptLine[] {
  return enrichPriorTranscriptLines(input.priorLines, {
    isPreset: input.isPreset,
    scenarioSlug: input.scenarioSlug,
    config: input.config,
    sessionSeed: resolveSessionSeed(input),
  });
}

function toRecentTurns(priorLines: TranscriptLine[]): ConversationTurn[] {
  return priorLines.map((line) => ({
    role: line.role,
    text: line.text,
  }));
}

function resolveClinicConfig(input: LiveTurnInput): ScenarioConfig | null {
  const base =
    input.config ??
    (input.isPreset && isClinicPreset(input.scenarioSlug)
      ? buildPresetScenarioConfig(input.scenarioSlug)
      : null);
  return applyVoiceAgentPersonality(base, input.voiceAgent);
}

const EVALUATE_COMMAND = "/evaluar";
const RESTART_COMMAND = "/reiniciar";

function resolvePracticeMode(input: LiveTurnInput): PracticeMode {
  return input.mode ?? "voz";
}

function resolveMaxTurns(): number {
  return SESSION_MAX_TURN_ALLOCATIONS;
}

async function runAgenticReply(
  effectiveConfig: ScenarioConfig,
  input: LiveTurnInput,
  round: ScenarioRoundDef,
  clientReaction: ClientReaction,
  fallbackReply: string,
  analytics: CallAnalytics,
  roundLabel: string,
): Promise<{ clientReply: string; coachingNote: string }> {
  const callAttemptId = input.sessionSeed?.trim() || input.scenarioSlug;
  const utterance = input.utterance.trim();
  const channel = resolvePracticeMode(input);
  const maxTurns = resolveMaxTurns();
  const turnNumber = resolveTurnNumber(input) || (input.priorLines.length / 2) + 1;
  const isEvaluate = utterance === EVALUATE_COMMAND;
  const isRestart = utterance === RESTART_COMMAND;

  let agenticState = isRestart
    ? resetAgenticSessionState(callAttemptId, input.difficultyLevel)
    : getAgenticSessionState(callAttemptId, input.difficultyLevel);

  if (!isRestart && !isEvaluate) {
    agenticState = {
      ...agenticState,
      turnNumber: agenticState.turnNumber + 1,
      meters: updateEmotionalMeters(agenticState.meters, {
        utterance,
        analytics,
        temperament: effectiveConfig.temperament,
        turnNumber: agenticState.turnNumber + 1,
        priorTurnNumber: agenticState.turnNumber,
      }),
    };
  }

  if (isEvaluate) {
    agenticState = { ...agenticState, mode: "evaluador" };
  }

  const presetClient = getClientBySlug(input.scenarioSlug);
  const pack = buildScenarioPack(
    effectiveConfig,
    effectiveConfig.agentic?.scenarioContextText,
    {
      clientName: input.clientName,
      clientTitle: presetClient?.title,
      companyContext: presetClient?.company ?? effectiveConfig.industry,
    },
  );
  const seed = resolveAgenticSeed(effectiveConfig, input.scenarioSlug);
  const tone = effectiveConfig.agentic?.toneId
    ? getToneById(effectiveConfig.agentic.toneId)
    : pickTone(seed, input.difficultyLevel);

  const recentTurns = toRecentTurns(input.priorLines);
  const patienceExhausted = shouldHangUpForPatience(agenticState.meters);
  const isCallEnding = turnNumber >= maxTurns || patienceExhausted;
  const forceEvaluator = isEvaluate || isCallEnding;

  const character = await generateCharacterReply({
    pack,
    config: effectiveConfig,
    tone,
    clientName: input.clientName,
    traineeUtterance: isRestart ? "" : utterance,
    roundLabel: input.roundLabel,
    reaction: clientReaction,
    fallbackText: fallbackReply,
    recentTurns: isRestart ? [] : recentTurns,
    channel,
    difficultyLevel: input.difficultyLevel,
    maxTurns,
    turnNumber,
    callAttemptId,
    agenticState,
    isCallEnding,
    forceEvaluator,
  });

  if (isRestart) {
    agenticState = { ...agenticState, mode: "cliente" };
  } else if (character.evaluatorMode) {
    agenticState = { ...agenticState, mode: "evaluador" };
  }

  saveAgenticSessionState(agenticState);

  const coachingNote = character.evaluatorMode
    ? "Evaluación generada. Escribe /reiniciar para practicar de nuevo."
    : await generateCoachNote({
        pack,
        traineeUtterance: utterance,
        roundLabel,
        analyticsSummary: `talk ${analytics.talkPercent}%, preguntas abiertas ${analytics.questionTypes.open}`,
      });

  return { clientReply: character.reply, coachingNote };
}

export async function scoreLiveTurn(input: LiveTurnInput): Promise<LiveTurnResult> {
  const priorLines = resolvePriorLines(input);
  const scoredInput: LiveTurnInput = { ...input, priorLines };

  const analytics = computeTurnAnalytics({
    utterance: input.utterance,
    priorLines,
  });

  const clientReaction = reactionFromAnalytics(analytics, input.utterance, scoredInput);
  let coachingNote = buildCoachingNote(
    analytics,
    input.roundLabel,
    input.utterance,
  );

  let clientReply: string;
  const sessionSeed = resolveSessionSeed(input);
  const turnNumber = resolveTurnNumber(input);

  if (scoredInput.isPreset && isClinicPreset(scoredInput.scenarioSlug)) {
    const roundType = resolveScoringRoundType(input);
    if (!roundType) {
      throw new Error(`Unknown clinic round for key ${input.roundKey}`);
    }

    const effectiveConfig = resolveClinicConfig(scoredInput);
    const templatedReply = getClientReply(
      scoredInput.scenarioSlug,
      roundType,
      clientReaction,
      {
        sessionSeed,
        turnNumber,
        priorLines,
        channel: resolvePracticeMode(scoredInput),
      },
    );

    const roundDef: ScenarioRoundDef = {
      key: roundType,
      label: ROUND_LABELS[roundType] ?? input.roundLabel,
      goal: ROUND_EXPECTED[roundType],
      clientPrompt: templatedReply,
      positiveCriteria: [],
      negativeCriteria: [],
    };

    const fallbackReply = templatedReply;

    if (effectiveConfig && isAgenticSessionActive(effectiveConfig)) {
      const agentic = await runAgenticReply(
        effectiveConfig,
        scoredInput,
        roundDef,
        clientReaction,
        fallbackReply,
        analytics,
        scoredInput.roundLabel,
      );
      clientReply = agentic.clientReply;
      coachingNote = agentic.coachingNote;
    } else {
      clientReply = templatedReply;
      if (isGroqAvailable() && effectiveConfig) {
        clientReply = await generateGroqClientReply(
          {
            config: effectiveConfig,
            round: roundDef,
            reaction: clientReaction,
            clientName: input.clientName,
            traineeUtterance: input.utterance,
            roundNumber: turnNumber,
          },
          templatedReply,
        );
      }
    }
  } else if (input.config) {
    const phaseKey = phaseKeyFromPersistenceKey(input.roundKey);
    const round: ScenarioRoundDef =
      input.config.rounds.find((r) => r.key === phaseKey) ?? {
        key: input.roundKey,
        label: input.roundLabel,
        goal: input.roundGoal,
        clientPrompt: input.roundGoal,
        positiveCriteria: [],
        negativeCriteria: [],
      };

    const effectiveConfig =
      applyVoiceAgentPersonality(input.config, input.voiceAgent) ?? input.config;

    const fallbackReply = templateClientReply(
      effectiveConfig,
      round,
      clientReaction,
      input.clientName,
    );

    if (isAgenticSessionActive(effectiveConfig)) {
      const agentic = await runAgenticReply(
        effectiveConfig,
        scoredInput,
        round,
        clientReaction,
        fallbackReply,
        analytics,
        scoredInput.roundLabel,
      );
      clientReply = agentic.clientReply;
      coachingNote = agentic.coachingNote;
    } else {
      clientReply = await generateClientReply({
        config: effectiveConfig,
        round,
        reaction: clientReaction,
        clientName: input.clientName,
        traineeUtterance: input.utterance,
        roundNumber: turnNumber,
      });
    }
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
