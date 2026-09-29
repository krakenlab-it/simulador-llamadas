import { generateText } from "ai";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import {
  buildLanguageLockSystemPrompt,
  resolveScenarioLanguage,
} from "@/lib/scenarios/language";
import type { ClientReaction } from "@/lib/scoring/rondas";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import {
  analyzeBuyerPsych,
  buildBuyerPsychBlock,
  buildBuyerRoleLock,
  BUYER_LIVE_TEMPERATURE,
  BUYER_MAX_OUTPUT_TOKENS,
  enforceBuyerTurnPolicy,
} from "./buyer-psych";
import {
  buyerToolsPromptHint,
  createBuyerAiSdkTools,
} from "./buyer-tools";
import {
  DEFAULT_CLIENT_LAYER_SETTINGS,
  parseCatalogClientPackSeed,
  toneHint,
  type ClientLayerSettings,
} from "./client-layer";
import {
  analyzeMeetingLogistics,
  buildLiveStateBlock,
  initialEmotionalMeters,
  acknowledgeOfferedSlot,
  repairDateDemandAfterAccept,
  updateEmotionalMeters,
  type ConversationTurn,
  type MeetingLogisticsState,
} from "./client-motor";
import { buildClientPack, formatClientPack } from "./client-pack";
import {
  buildBuyerHarnessContextBlocks,
  buildImpersonationChatMessages,
  enforceHarnessNoRepeat,
  isHardRepeatViolation,
  mergeClientReplies,
} from "./dialogue-memory";
import { composeSeparatedSystemPrompt } from "./roles";
import {
  readProviderAvailability,
  resolveAgentProvider,
} from "./availability";
import { createAgentModel } from "./provider";

export const IMPERSONATION_TIMEOUT_MS = 8_000;

export interface ImpersonationInput {
  config: ScenarioConfig;
  round: ScenarioRoundDef;
  reaction: ClientReaction;
  clientName: string;
  traineeUtterance: string;
  roundNumber: number;
  scenarioSlug?: string;
  recentReplies?: string[];
  askedQuestions?: string[];
  priorTurns?: ConversationTurn[];
  difficultyLevel?: DifficultyLevel;
  mode?: PracticeMode;
  clientLayer?: ClientLayerSettings;
}

function logisticsGrantInstruction(logistics: MeetingLogisticsState): string {
  if (logistics.shouldAcknowledgeSlot) {
    return "El vendedor ofreció un horario concreto después de que aceptaste la presentación. Confirma ESE día y hora y avanza a logística (tablero del local / invitación). Nunca pidas otra vez día y hora ni digas «sin día y hora… local».";
  }
  if (logistics.meetingAccepted) {
    return "Ya aceptaste el siguiente paso. No pidas otra vez día y hora.";
  }
  return "Aún no concedas la cita si faltan las condiciones del pack.";
}

export function buildImpersonationRoles(input: ImpersonationInput): {
  agent: string;
  user: string;
  context: string;
  psych: ReturnType<typeof analyzeBuyerPsych>;
} {
  const language = resolveScenarioLanguage(input.config);
  const preset = input.scenarioSlug
    ? getCatalogPreset(input.scenarioSlug)
    : undefined;
  const mood =
    input.reaction === "bien"
      ? "interesado pero exigente"
      : input.reaction === "medio"
        ? "escéptico, poco tiempo"
        : "frustrado, a punto de colgar";
  const questions = preset?.questionBank ?? [];
  const asked = new Set(
    (input.askedQuestions ?? []).map((item) => item.trim().toLowerCase()),
  );
  const unused = questions.filter((item) => !asked.has(item.toLowerCase()));
  const layer = input.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS;
  const difficulty = input.difficultyLevel ?? 1;
  const configuredPhases = input.config.rounds.length || 5;
  const pack = buildClientPack({
    clientName: input.clientName,
    clientTitle: preset?.title,
    company: preset?.company,
    config: input.config,
    seed: preset?.clientPack ?? parseCatalogClientPackSeed(input.config.clientPack),
    difficultyLevel: difficulty,
    mode: input.mode,
    maxTurns: configuredPhases,
  });
  const priorTurns = input.priorTurns ?? [];
  const logistics = analyzeMeetingLogistics(priorTurns, input.traineeUtterance);
  const meters = updateEmotionalMeters(
    initialEmotionalMeters(difficulty),
    input.traineeUtterance,
    pack.temperament,
    input.roundNumber,
  );
  const liveBlock = buildLiveStateBlock({
    meters,
    logistics,
    turnNumber: input.roundNumber,
    maxTurns: Math.max(configuredPhases, input.roundNumber),
  });
  const tone = toneHint(layer.toneId, mood);
  const psych = analyzeBuyerPsych({
    traineeUtterance: input.traineeUtterance,
    priorTurns,
    roundNumber: input.roundNumber,
    scenarioSlug: input.scenarioSlug,
    pack,
    logistics,
  });

  const agent = [
    buildBuyerRoleLock({
      name: input.clientName,
      title: pack.clientTitle || preset?.title,
      setting: pack.company || preset?.company,
      hiddenGoals: pack.grantConditions,
      state: psych,
    }),
    `Temperamento: ${pack.temperament}. Tono: ${tone}.`,
    `Rol en la decisión: ${pack.decisionRole}.`,
    buildLanguageLockSystemPrompt(language),
    "No inventes datos fuera del pack. Lo que ya aceptaste sigue aceptado.",
    logisticsGrantInstruction(logistics),
    buyerToolsPromptHint(),
    "No repitas una pregunta que ya hiciste. No clones la última réplica.",
    input.roundNumber > configuredPhases
      ? `Llevas ${input.roundNumber} turnos: avanza (logística, confirmación o salida). No repitas la misma objeción.`
      : "",
    unused[0] && (psych.phase === "opening_id" || psych.phase === "reason_probe")
      ? `Si preguntas algo, una sola variante de: ${unused[0]}`
      : "Este turno termina en afirmación o salida suave, no en otra pregunta.",
  ].join("\n");

  const user =
    "Responde solo como el cliente a la última línea del vendedor en los mensajes. No copies tus réplicas anteriores.";

  const recentClientReplies = mergeClientReplies(priorTurns, input.recentReplies ?? []);

  const harnessContext = buildBuyerHarnessContextBlocks({
    priorTurns,
    recentClientReplies,
    psych,
    logistics,
    roundNumber: input.roundNumber,
  });

  const context = [
    formatClientPack(pack),
    liveBlock,
    buildBuyerPsychBlock(psych),
    harnessContext,
    `Turno de práctica: ${input.round.label} (${input.roundNumber})`,
    questions.length
      ? `Banco de este cliente (no es un quiz; usa una solo si la fase pide pregunta):\n- ${questions.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { agent, user, context, psych };
}

export function buildImpersonationPrompt(input: ImpersonationInput): string {
  const roles = buildImpersonationRoles(input);
  return composeSeparatedSystemPrompt(roles);
}

export function isCloneReply(candidate: string, recentReplies: string[]): boolean {
  return isHardRepeatViolation(candidate, recentReplies);
}

export async function generateImpersonatedReply(
  input: ImpersonationInput,
  fallbackText: string,
): Promise<string> {
  const layer = input.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS;
  if (!layer.motorEnabled) return fallbackText;

  const availability = readProviderAvailability();
  if (!availability.hasModel) return fallbackText;

  const provider = resolveAgentProvider("auto", availability);
  const model = createAgentModel(provider);
  if (!model) return fallbackText;

  const roles = buildImpersonationRoles(input);
  const priorTurns = input.priorTurns ?? [];
  const recentClientReplies = mergeClientReplies(priorTurns, input.recentReplies ?? []);
  const logistics = analyzeMeetingLogistics(priorTurns, input.traineeUtterance);
  const psych = roles.psych;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMPERSONATION_TIMEOUT_MS);
  let toolSpoken = "";
  const tools = createBuyerAiSdkTools(psych, input.traineeUtterance, (result) => {
    toolSpoken = result.spoken;
  });

  try {
    const chatMessages = buildImpersonationChatMessages({
      priorTurns,
      traineeUtterance: input.traineeUtterance,
    });

    const result = await generateText({
      model,
      system: composeSeparatedSystemPrompt(roles),
      messages: chatMessages,
      tools: tools as Parameters<typeof generateText>[0]["tools"],
      temperature: BUYER_LIVE_TEMPERATURE,
      maxOutputTokens: BUYER_MAX_OUTPUT_TOKENS,
      abortSignal: controller.signal,
    });
    let text = (result.text?.trim() || toolSpoken).trim();
    if (!text || text.length > 400) text = fallbackText;
    const policed = enforceBuyerTurnPolicy(
      text,
      psych,
      input.traineeUtterance,
      recentClientReplies,
    );
    let finalLine = policed;
    const rememberedSlot = psych.offeredSlot ?? input.traineeUtterance;
    if (logistics.shouldAcknowledgeSlot) {
      const repaired = repairDateDemandAfterAccept(
        policed,
        rememberedSlot,
        input.roundNumber,
      );
      if (repaired) finalLine = repaired;
    }
    const primaryFallback = logistics.shouldAcknowledgeSlot
      ? acknowledgeOfferedSlot(rememberedSlot, input.roundNumber)
      : fallbackText;
    return enforceHarnessNoRepeat({
      candidate: finalLine,
      recentClientReplies,
      psych,
      primaryFallback,
      turnNumber: input.roundNumber,
    });
  } catch {
    const rememberedSlot = psych.offeredSlot ?? input.traineeUtterance;
    const primaryFallback = logistics.shouldAcknowledgeSlot
      ? acknowledgeOfferedSlot(rememberedSlot, input.roundNumber)
      : fallbackText;
    return enforceHarnessNoRepeat({
      candidate: primaryFallback,
      recentClientReplies,
      psych,
      primaryFallback,
      turnNumber: input.roundNumber,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
