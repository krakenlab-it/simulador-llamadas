import type { ScenarioConfig } from "@/lib/scenarios/types";
import type { ScenarioRoundDef } from "@/lib/scenarios/types";
import { buildScenarioPack } from "./scenario-pack";

export interface AgenticContextInput {
  companyContext?: string;
  clientProblem?: string;
  productSold?: string;
  industry?: string;
  winCriteria?: string;
  temperament?: string;
  clientTitle?: string;
  objections?: string[];
  rounds?: ScenarioRoundDef[];
}

/**
 * Builds a single grounded context blob from scenario/wizard fields (and optional doc text).
 */
export function buildAgenticScenarioContextText(
  input: AgenticContextInput,
  uploadedContextText = "",
): string {
  const parts: string[] = [];

  const doc = uploadedContextText.trim();
  if (doc) parts.push(doc);

  if (input.companyContext?.trim()) {
    parts.push(`Empresa: ${input.companyContext.trim()}`);
  }
  if (input.industry?.trim()) {
    parts.push(`Industria: ${input.industry.trim()}`);
  }
  if (input.clientTitle?.trim()) {
    parts.push(`Cargo del cliente: ${input.clientTitle.trim()}`);
  }
  if (input.productSold?.trim()) {
    parts.push(`Producto: ${input.productSold.trim()}`);
  }
  if (input.clientProblem?.trim()) {
    parts.push(`Problema: ${input.clientProblem.trim()}`);
  }
  if (input.winCriteria?.trim()) {
    parts.push(`Criterio de éxito: ${input.winCriteria.trim()}`);
  }
  if (input.temperament?.trim()) {
    parts.push(`Temperamento: ${input.temperament.trim()}`);
  }
  if (input.objections?.length) {
    const cleaned = input.objections.map((o) => o.trim()).filter(Boolean);
    if (cleaned.length) parts.push(`Objeciones: ${cleaned.join("; ")}`);
  }

  for (const round of input.rounds ?? []) {
    const roundParts = [
      round.label,
      round.goal,
      round.clientPrompt,
      round.whatGoodLooksLike,
      round.positiveCriteria.length
        ? `Criterios+: ${round.positiveCriteria.join(", ")}`
        : "",
      round.negativeCriteria.length
        ? `Criterios-: ${round.negativeCriteria.join(", ")}`
        : "",
    ].filter(Boolean);
    if (roundParts.length) {
      parts.push(`Ronda ${round.label}: ${roundParts.join(" · ")}`);
    }
  }

  return parts.join("\n\n");
}

export const AGENTIC_GROUNDING_PENDING_MESSAGE =
  "Sube documentación o completa producto/problema para anclar la capa agentica.";

const MIN_DOC_CONTEXT_CHARS = 40;

/**
 * Agentic layer needs uploaded docs OR filled product + problem on the scenario.
 */
export function hasMinimumAgenticGrounding(config: ScenarioConfig): boolean {
  const pack = buildScenarioPack(config);
  const hasDocs = pack.contextText.trim().length >= MIN_DOC_CONTEXT_CHARS;
  const hasProduct = Boolean(config.productSold?.trim());
  const hasProblem = Boolean(config.clientProblem?.trim());
  return hasDocs || (hasProduct && hasProblem);
}

export function getAgenticGroundingPendingMessage(
  config: ScenarioConfig,
): string | null {
  return hasMinimumAgenticGrounding(config)
    ? null
    : AGENTIC_GROUNDING_PENDING_MESSAGE;
}
