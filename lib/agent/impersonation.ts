import { generateText } from "ai";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import {
  buildLanguageLockSystemPrompt,
  resolveScenarioLanguage,
} from "@/lib/scenarios/language";
import type { ClientReaction } from "@/lib/scoring/rondas";
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

  const agent = [
    `Eres ${input.clientName}. Interpretas a ESTE comprador, no a un cliente genérico.`,
    `Temperamento: ${input.config.temperament}. Tono: ${mood}.`,
    buildLanguageLockSystemPrompt(language),
    "Nunca hables como el vendedor. Nunca des coaching. Solo la réplica del cliente.",
    "1-2 oraciones cortas. Sin comillas ni explicación.",
    "No repitas una pregunta que ya hiciste. No clones la última réplica.",
    unused[0]
      ? `Si preguntas algo, usa una variante de: ${unused[0]}`
      : "Si preguntas, cambia el ángulo (número, riesgo, plazo, quién decide).",
  ].join("\n");

  const user = `El vendedor (usuario) dijo: "${input.traineeUtterance}"`;

  const context = [
    `Industria: ${input.config.industry}`,
    `Problema: ${input.config.clientProblem}`,
    `Compra/vende: ${input.config.productSold}`,
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
    .join("\n");

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
