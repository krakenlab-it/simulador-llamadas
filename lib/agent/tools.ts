import { z } from "zod";
import {
  defaultDifficultyLabel,
  defaultTemperament,
  defaultWinCriteria,
  draftToCreateInput,
  emptyAuthoringDraft,
  validateAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";
import { isScenarioCallType, isScenarioLanguage } from "@/lib/scenarios/types";
import type {
  AgentToolId,
  AgentToolSession,
  PublicScenarioSummary,
} from "./types";

const languageSchema = z.enum(["es", "en"]);
const callTypeSchema = z.enum(["fria", "discovery", "cierre"]);

export const proposeScenarioSchema = z.object({
  clientName: z.string().min(1).describe("Nombre del comprador"),
  clientTitle: z.string().min(1).describe("Rol o cargo"),
  companyContext: z.string().min(1).describe("Empresa o contexto"),
  industry: z.string().min(1).describe("Industria"),
  productSold: z.string().min(1).describe("Qué se vende"),
  clientProblem: z.string().min(1).describe("Dolor o problema actual"),
  objections: z.array(z.string()).optional(),
  temperament: z.string().optional(),
  winCriteria: z.string().optional(),
  language: languageSchema.optional(),
  callType: callTypeSchema.optional(),
  difficultyLabel: z.string().optional(),
});

export const patchDraftSchema = proposeScenarioSchema.partial();

export const applyScenarioSchema = z.object({
  confirm: z
    .boolean()
    .describe("true para validar el borrador y dejarlo listo para guardar"),
});

export const listCatalogSchema = z.object({});
export const resetDraftSchema = z.object({});

export type ProposeScenarioInput = z.infer<typeof proposeScenarioSchema>;
export type PatchDraftInput = z.infer<typeof patchDraftSchema>;

export const AGENT_TOOL_CATALOG: Array<{
  id: AgentToolId;
  label: string;
  description: string;
}> = [
  {
    id: "list_catalog",
    label: "Ver catálogo",
    description: "Lista los escenarios ya cargados (presets y personalizados).",
  },
  {
    id: "propose_scenario",
    label: "Proponer escenario",
    description: "Arma un borrador completo a partir de la conversación.",
  },
  {
    id: "patch_draft",
    label: "Ajustar borrador",
    description: "Cambia campos del borrador actual sin empezar de cero.",
  },
  {
    id: "apply_scenario",
    label: "Confirmar escenario",
    description: "Valida el borrador y lo deja listo para guardar en la app.",
  },
  {
    id: "reset_draft",
    label: "Reiniciar borrador",
    description: "Limpia el borrador y vuelve a los defaults del idioma.",
  },
];

function asLanguage(
  value: string | undefined,
  fallback: ScenarioAuthoringDraft["language"],
): ScenarioAuthoringDraft["language"] {
  return value && isScenarioLanguage(value) ? value : fallback;
}

function asCallType(
  value: string | undefined,
  fallback: ScenarioAuthoringDraft["callType"],
): ScenarioAuthoringDraft["callType"] {
  return value && isScenarioCallType(value) ? value : fallback;
}

export function draftFromProposal(
  input: ProposeScenarioInput,
  session: AgentToolSession,
): ScenarioAuthoringDraft {
  const language = asLanguage(input.language, session.settings.language);
  const base = session.draft ?? emptyAuthoringDraft(language);
  const objections =
    input.objections && input.objections.length > 0
      ? input.objections.map((item) => item.trim()).filter(Boolean)
      : base.objections;

  return {
    ...base,
    language,
    callType: asCallType(input.callType, session.settings.callType),
    clientName: input.clientName.trim(),
    clientTitle: input.clientTitle.trim(),
    companyContext: input.companyContext.trim(),
    industry: input.industry.trim(),
    productSold: input.productSold.trim(),
    clientProblem: input.clientProblem.trim(),
    objections: objections.length > 0 ? objections : ["", ""],
    temperament: input.temperament?.trim() || defaultTemperament(language),
    winCriteria: input.winCriteria?.trim() || defaultWinCriteria(language),
    difficultyLabel:
      input.difficultyLabel?.trim() || defaultDifficultyLabel(language),
  };
}

export function executeListCatalog(
  session: AgentToolSession,
): PublicScenarioSummary[] {
  return session.catalog;
}

export function executeProposeScenario(
  input: ProposeScenarioInput,
  session: AgentToolSession,
): { draft: ScenarioAuthoringDraft; valid: boolean; error: string | null } {
  const draft = draftFromProposal(input, session);
  session.draft = draft;
  session.appliedInput = null;
  const error = validateAuthoringDraft(draft);
  return { draft, valid: error === null, error };
}

export function executePatchDraft(
  input: PatchDraftInput,
  session: AgentToolSession,
): { draft: ScenarioAuthoringDraft; valid: boolean; error: string | null } {
  const current = session.draft ?? emptyAuthoringDraft(session.settings.language);
  const merged: ProposeScenarioInput = {
    clientName: input.clientName ?? current.clientName,
    clientTitle: input.clientTitle ?? current.clientTitle,
    companyContext: input.companyContext ?? current.companyContext,
    industry: input.industry ?? current.industry,
    productSold: input.productSold ?? current.productSold,
    clientProblem: input.clientProblem ?? current.clientProblem,
    objections: input.objections ?? current.objections,
    temperament: input.temperament ?? current.temperament,
    winCriteria: input.winCriteria ?? current.winCriteria,
    language: input.language ?? current.language,
    callType: input.callType ?? current.callType,
    difficultyLabel: input.difficultyLabel ?? current.difficultyLabel,
  };
  return executeProposeScenario(merged, session);
}

export function executeApplyScenario(
  input: { confirm: boolean },
  session: AgentToolSession,
): {
  applied: boolean;
  error: string | null;
  draft: ScenarioAuthoringDraft | null;
} {
  if (!input.confirm) {
    return {
      applied: false,
      error: "El usuario no confirmó.",
      draft: session.draft,
    };
  }
  if (!session.draft) {
    return { applied: false, error: "No hay borrador para guardar.", draft: null };
  }
  const error = validateAuthoringDraft(session.draft);
  if (error) {
    return { applied: false, error, draft: session.draft };
  }
  session.appliedInput = draftToCreateInput(session.draft);
  return { applied: true, error: null, draft: session.draft };
}

export function executeResetDraft(session: AgentToolSession): {
  draft: ScenarioAuthoringDraft;
} {
  session.draft = emptyAuthoringDraft(session.settings.language);
  session.appliedInput = null;
  return { draft: session.draft };
}

export function toolLabel(id: AgentToolId): string {
  const found = AGENT_TOOL_CATALOG.find((tool) => tool.id === id);
  return found?.label ?? id;
}
