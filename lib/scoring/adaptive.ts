import type { DifficultyLevel } from "@/lib/db/types";
import { enrichClinicFeedback } from "@/lib/feedback/evaluation";
import { generateClientReply, isLlmAvailable } from "@/lib/llm/client-replies";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import type { RichTurnFeedback, ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import { isClinicPreset } from "@/lib/scenarios/types";
import { scoreCustomTurn } from "./custom";
import { analizar } from "./analizar";
import { getClientReply } from "./reactions";
import { puntua, ROUND_EXPECTED, type ClientReaction } from "./rondas";
import { ROUND_POSITIVES } from "./rondas-criteria";

export interface AdaptiveScoreInput {
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
}

export interface AdaptiveScoreResult {
  keywordHits: Record<string, boolean>;
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

const ROUND_LABELS: Record<string, string> = {
  apertura: "Apertura",
  objecion: "Objeción",
  claridad: "Claridad",
  correo: "Correo",
  cierre: "Cierre",
};

function getMissedClinicCriteria(
  roundKey: string,
  hits: Record<string, boolean>,
): string[] {
  const positives = ROUND_POSITIVES[roundKey as keyof typeof ROUND_POSITIVES];
  if (!positives) return [];
  const labels: Record<string, string> = {
    problema: "problema",
    medicion: "medición",
    jerga: "jerga del sector",
    reconocimiento: "reconocimiento",
    reunion: "reunión",
    dia_hora: "día/hora",
    se_presenta_solo: "presentación",
  };
  return positives
    .filter((k) => !hits[k])
    .map((k) => labels[k] ?? k);
}

export async function scoreTurnAdaptive(
  input: AdaptiveScoreInput,
): Promise<AdaptiveScoreResult> {
  if (input.isPreset && isClinicPreset(input.scenarioSlug)) {
    const roundType = input.roundKey as Parameters<typeof puntua>[0];
    const analisis = analizar(input.utterance);
    const puntuacion = puntua(roundType, analisis, input.difficultyLevel);
    const templatedReply = getClientReply(
      input.scenarioSlug,
      roundType,
      puntuacion.reaction,
    );

    let clientReply = templatedReply;
    if (isLlmAvailable()) {
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
        clientReply = await generateClientReply(
          {
            config: presetConfig,
            round: roundDef,
            reaction: puntuacion.reaction,
            clientName: input.clientName,
            traineeUtterance: input.utterance,
            roundNumber: 0,
          },
          templatedReply,
        );
      }
    }

    const richFeedback = enrichClinicFeedback({
      utterance: input.utterance,
      roundScore: puntuacion.roundScore,
      roundLabel: ROUND_LABELS[input.roundKey] ?? input.roundLabel,
      roundGoal: ROUND_EXPECTED[roundType],
      keywordHits: analisis.hits,
      missedCriteriaLabels: getMissedClinicCriteria(input.roundKey, analisis.hits),
    });

    return {
      keywordHits: analisis.hits,
      hasDay: analisis.hasDay,
      hasTime: analisis.hasTime,
      roundScore: puntuacion.roundScore,
      feedback: puntuacion.feedback,
      clientReaction: puntuacion.reaction,
      clientReply,
      hasConcreteDayAndTime: puntuacion.hasConcreteDayAndTime,
      won: puntuacion.won,
      richFeedback,
    };
  }

  const round: ScenarioRoundDef =
    input.config?.rounds.find((r) => r.key === input.roundKey) ?? {
      key: input.roundKey,
      label: input.roundLabel,
      goal: input.roundGoal,
      clientPrompt: input.roundGoal,
      positiveCriteria: input.config?.globalPositiveCriteria ?? ["problema"],
      negativeCriteria: ["monologo", "telegrama"],
    };

  const custom = scoreCustomTurn({
    utterance: input.utterance,
    round,
    config: input.config!,
    difficultyLevel: input.difficultyLevel,
    clientName: input.clientName,
    isLastRound: input.isLastRound,
  });

  const clientReply = await generateClientReply({
    config: input.config!,
    round,
    reaction: custom.reaction,
    clientName: input.clientName,
    traineeUtterance: input.utterance,
    roundNumber: 0,
  });

  return {
    keywordHits: custom.keywordHits,
    hasDay: custom.hasConcreteDayAndTime || /\d{1,2}\s+de/i.test(input.utterance),
    hasTime: custom.hasConcreteDayAndTime,
    roundScore: custom.roundScore,
    feedback: custom.feedback,
    clientReaction: custom.reaction,
    clientReply,
    hasConcreteDayAndTime: custom.hasConcreteDayAndTime,
    won: custom.won,
    richFeedback: custom.richFeedback,
  };
}

