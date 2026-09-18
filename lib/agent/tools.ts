import { z } from "zod";
import {
  draftToCreateInput,
  emptyAuthoringDraft,
  validateAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";
import type { AgentToolId, AgentToolSession } from "./types";

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
  confirm: z.boolean().describe("true para validar y dejar listo para guardar"),
});
export const listCatalogSchema = z.object({});
export const resetDraftSchema = z.object({});
export const listTeamsSchema = z.object({});
export const compareTeamTestSchema = z.object({
  teamId: z.string().min(1),
  testId: z.string().min(1),
});

export const AGENT_TOOL_CATALOG: Array<{
  id: AgentToolId;
  label: string;
  description: string;
}> = [
  {
    id: "list_catalog",
    label: "Ver catálogo",
    description: "Lista los escenarios PREFILLED y personalizados.",
  },
  {
    id: "propose_scenario",
    label: "Proponer escenario",
    description: "Arma un borrador completo a partir de la conversación.",
  },
  {
    id: "patch_draft",
    label: "Ajustar borrador",
    description: "Cambia campos del borrador actual.",
  },
  {
    id: "apply_scenario",
    label: "Confirmar escenario",
    description: "Valida el borrador y lo deja listo para guardar.",
  },
  {
    id: "reset_draft",
    label: "Reiniciar borrador",
    description: "Limpia el borrador.",
  },
  {
    id: "list_teams",
    label: "Ver equipos",
    description: "Lista equipos de práctica (mismo examen).",
  },
  {
    id: "compare_team_test",
    label: "Comparar examen",
    description: "Compara a los miembros en el mismo test.",
  },
];

export function draftFromProposal(
  input: z.infer<typeof proposeScenarioSchema>,
  session: AgentToolSession,
): ScenarioAuthoringDraft {
  const base = session.draft ?? emptyAuthoringDraft(session.settings.language);
  const callType =
    input.callType ??
    (session.settings.presetId === "cierre" ? "cierre" : session.settings.callType);
  return {
    ...base,
    clientName: input.clientName,
    clientTitle: input.clientTitle,
    companyContext: input.companyContext,
    industry: input.industry,
    productSold: input.productSold,
    clientProblem: input.clientProblem,
    objections: input.objections?.filter(Boolean) ?? base.objections,
    temperament: input.temperament?.trim() || base.temperament,
    winCriteria:
      input.winCriteria?.trim() ||
      (session.settings.language === "en"
        ? "Meeting with a concrete day and time"
        : "Reunión con día y hora concretos"),
    language: input.language ?? session.settings.language,
    callType,
    difficultyLabel: input.difficultyLabel?.trim() || base.difficultyLabel,
  };
}

export function executeListCatalog(session: AgentToolSession): {
  ok: boolean;
  summary: string;
  catalog: AgentToolSession["catalog"];
} {
  return {
    ok: true,
    summary: `${session.catalog.length} escenarios en catálogo`,
    catalog: session.catalog,
  };
}

export function executeProposeScenario(
  session: AgentToolSession,
  input: z.infer<typeof proposeScenarioSchema>,
): { ok: boolean; summary: string; error?: string } {
  session.draft = draftFromProposal(input, session);
  const error = validateAuthoringDraft(session.draft);
  if (error) return { ok: false, summary: error, error };
  return { ok: true, summary: `Borrador: ${session.draft.clientName}` };
}

export function executePatchDraft(
  session: AgentToolSession,
  input: z.infer<typeof patchDraftSchema>,
): { ok: boolean; summary: string; error?: string } {
  if (!session.draft) {
    return { ok: false, summary: "No hay borrador.", error: "No hay borrador." };
  }
  const merged = {
    clientName: input.clientName ?? session.draft.clientName,
    clientTitle: input.clientTitle ?? session.draft.clientTitle,
    companyContext: input.companyContext ?? session.draft.companyContext,
    industry: input.industry ?? session.draft.industry,
    productSold: input.productSold ?? session.draft.productSold,
    clientProblem: input.clientProblem ?? session.draft.clientProblem,
    objections: input.objections ?? session.draft.objections,
    temperament: input.temperament ?? session.draft.temperament,
    winCriteria: input.winCriteria ?? session.draft.winCriteria,
    language: input.language ?? session.draft.language,
    callType: input.callType ?? session.draft.callType,
    difficultyLabel: input.difficultyLabel ?? session.draft.difficultyLabel,
  };
  return executeProposeScenario(session, merged);
}

export function executeApplyScenario(
  session: AgentToolSession,
  input: z.infer<typeof applyScenarioSchema>,
): { ok: boolean; summary: string; error?: string } {
  if (!input.confirm) {
    return { ok: false, summary: "Confirmación requerida.", error: "confirm=false" };
  }
  if (!session.draft) {
    return { ok: false, summary: "No hay borrador.", error: "No hay borrador." };
  }
  const error = validateAuthoringDraft(session.draft);
  if (error) return { ok: false, summary: error, error };
  session.appliedInput = draftToCreateInput(session.draft);
  return { ok: true, summary: `Listo para guardar: ${session.draft.clientName}` };
}

export function executeResetDraft(session: AgentToolSession): {
  ok: boolean;
  summary: string;
} {
  session.draft = emptyAuthoringDraft(session.settings.language);
  session.appliedInput = null;
  return { ok: true, summary: "Borrador reiniciado." };
}

export function createToolSession(
  input: Pick<
    AgentToolSession,
    "draft" | "catalog" | "settings" | "teamId" | "testId"
  >,
): AgentToolSession {
  return {
    draft: input.draft,
    catalog: input.catalog,
    settings: input.settings,
    appliedInput: null,
    comparison: null,
    teamId: input.teamId,
    testId: input.testId,
  };
}
