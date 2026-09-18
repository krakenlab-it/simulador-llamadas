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
  DEFAULT_CLIENT_LAYER_SETTINGS,
  toneHint,
  type ClientLayerSettings,
} from "./client-layer";
import {
  analyzeMeetingLogistics,
  buildLiveStateBlock,
  initialEmotionalMeters,
  updateEmotionalMeters,
  type ConversationTurn,
} from "./client-motor";
import { buildClientPack, formatClientPack } from "./client-pack";
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

export function buildImpersonationRoles(input: ImpersonationInput): {
  agent: string;
  user: string;
  context: string;
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
  const recent = (input.recentReplies ?? []).slice(-4);
  const layer = input.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS;
  const difficulty = input.difficultyLevel ?? 1;
  const pack = buildClientPack({
    clientName: input.clientName,
    clientTitle: preset?.title,
    company: preset?.company,
    config: input.config,
    seed: preset?.clientPack,
    difficultyLevel: difficulty,
    mode: input.mode,
    maxTurns: input.config.rounds.length || 5,
  });
  const priorTurns = input.priorTurns ?? [];
  const logistics = analyzeMeetingLogistics(priorTurns, input.traineeUtterance);
  let meters = initialEmotionalMeters(difficulty);
  let traineeTurnIndex = 0;
  for (const turn of priorTurns) {
    if (turn.role !== "trainee") continue;
    traineeTurnIndex += 1;
    meters = updateEmotionalMeters(
      meters,
      turn.text,
      pack.temperament,
      traineeTurnIndex,
    );
  }
  const currentTurn =
    input.roundNumber > 0 ? input.roundNumber : traineeTurnIndex + 1;
  meters = updateEmotionalMeters(
    meters,
    input.traineeUtterance,
    pack.temperament,
    currentTurn,
  );
  const liveBlock = buildLiveStateBlock({
    meters,
    logistics,
    turnNumber: input.roundNumber,
    maxTurns: pack.maxTurns,
  });
  const tone = toneHint(layer.toneId, mood);

  const agent = [
    `Eres ${input.clientName}. Interpretas a ESTE comprador, no a un cliente genérico.`,
    `Temperamento: ${pack.temperament}. Tono: ${tone}.`,
    `Rol en la decisión: ${pack.decisionRole}.`,
    buildLanguageLockSystemPrompt(language),
    "Modo CLIENTE del motor: una sola intervención, 1-3 oraciones. Nunca coach ni evaluador.",
    "Nunca hables como el vendedor. Nunca des coaching. Solo la réplica del cliente.",
    "No inventes datos fuera del pack. Lo que ya aceptaste sigue aceptado.",
    logistics.meetingAccepted
      ? "Ya aceptaste la cita. No pidas otra vez día y hora."
      : "Aún no concedas la cita si faltan las condiciones del pack.",
    "No repitas una pregunta que ya hiciste. No clones la última réplica.",
    unused[0]
      ? `Si preguntas algo, usa una variante de: ${unused[0]}`
      : "Si preguntas, cambia el ángulo (número, riesgo, plazo, quién decide).",
  ].join("\n");

  const user = `El vendedor (usuario) dijo: "${input.traineeUtterance}"`;

  const context = [
    formatClientPack(pack),
    liveBlock,
    `Fase: ${input.round.label} (turno ${input.roundNumber})`,
    input.round.whatGoodLooksLike
      ? `Qué se espera del vendedor: ${input.round.whatGoodLooksLike}`
      : "",
    recent.length ? `Réplicas recientes (NO clones):\n- ${recent.join("\n- ")}` : "",
    questions.length
      ? `Banco de preguntas de este cliente (elige una no usada):\n- ${questions.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { agent, user, context };
}

export function buildImpersonationPrompt(input: ImpersonationInput): string {
  const roles = buildImpersonationRoles(input);
  return composeSeparatedSystemPrompt(roles);
}

export function isCloneReply(candidate: string, recentReplies: string[]): boolean {
  const normalized = candidate.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 8) return true;
  return recentReplies.some((item) => {
    const other = item.trim().toLowerCase().replace(/\s+/g, " ");
    return other === normalized || (other.length > 12 && normalized.includes(other));
  });
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMPERSONATION_TIMEOUT_MS);

  try {
    const result = await generateText({
      model,
      system: composeSeparatedSystemPrompt(roles),
      messages: [{ role: "user", content: roles.user }],
      temperature: 0.85,
      abortSignal: controller.signal,
    });
    const text = result.text?.trim() ?? "";
    if (text.length < 8 || text.length > 400) return fallbackText;
    if (isCloneReply(text, input.recentReplies ?? [])) return fallbackText;
    return text;
  } catch {
    return fallbackText;
  } finally {
    clearTimeout(timeoutId);
  }
}
