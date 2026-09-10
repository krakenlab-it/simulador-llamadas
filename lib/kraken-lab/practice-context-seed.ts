import { SCORE_DIMENSIONS } from "@/lib/scoring/dimensions";
import type { ScoreDimensionId } from "@/lib/scoring/types";
import { loadAnyBuilderDraftFromStorage } from "@/lib/scenarios/builder-draft-storage";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import { loadLocalCustomScenarios } from "@/lib/scenarios/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import { fullScenarioContextText } from "./scenario-context";
import {
  inferContextIndustryFromBrief,
  mergeScenarioContextUpload,
} from "./context-from-industry";
import {
  getProjectContextPack,
  getProjectIndustry,
  resolveActiveProject,
  updateActiveProjectIndustryPack,
  updateActiveProjectScenarioContext,
} from "./project-context-packs";
import {
  loadWizardDraftFromStorage,
  wizardDraftHasScenarioContextContent,
} from "./wizard-draft-storage";
import type { KrakenLabCohortConfig } from "./types";

export const MIN_SCENARIO_CONTEXT_CHARS = 30;

const DIMENSION_LABELS = new Map<ScoreDimensionId, string>(
  SCORE_DIMENSIONS.map((dim) => [dim.id, dim.label]),
);

function dimensionLabel(id: string): string {
  return DIMENSION_LABELS.get(id as ScoreDimensionId) ?? id.replace(/_/g, " ");
}

export function buildPracticeBriefFromAuthoringDraft(
  draft: ScenarioAuthoringDraft,
): string {
  const lines: string[] = [];

  if (draft.clientName.trim()) {
    const role = draft.clientTitle.trim() ? ` (${draft.clientTitle.trim()})` : "";
    const company = draft.companyContext.trim() ? ` · ${draft.companyContext.trim()}` : "";
    lines.push(`Cliente: ${draft.clientName.trim()}${role}${company}`);
  }
  if (draft.industry.trim()) lines.push(`Industria: ${draft.industry.trim()}`);
  if (draft.productSold.trim()) lines.push(`Producto/servicio: ${draft.productSold.trim()}`);
  if (draft.clientProblem.trim()) lines.push(`Problema: ${draft.clientProblem.trim()}`);

  const objections = draft.objections.map((item) => item.trim()).filter(Boolean);
  if (objections.length > 0) {
    lines.push(`Objeciones: ${objections.map((item) => `- ${item}`).join(" ")}`);
  }
  if (draft.winCriteria.trim()) {
    lines.push(`Criterio de éxito: ${draft.winCriteria.trim()}`);
  }

  const guides = Object.entries(draft.dimensionGuides ?? {}).filter(
    ([, value]) => value?.trim(),
  );
  if (guides.length > 0) {
    lines.push("Guías de evaluación:");
    for (const [id, value] of guides) {
      lines.push(`- ${dimensionLabel(id)}: ${value.trim()}`);
    }
  }

  return lines.join("\n").trim();
}

export function buildPracticeBriefFromScenarioRecord(record: ScenarioRecord): string {
  const lines: string[] = [];

  if (record.clientName.trim()) {
    const role = record.clientTitle?.trim() ? ` (${record.clientTitle.trim()})` : "";
    const company = record.companyContext?.trim() ? ` · ${record.companyContext.trim()}` : "";
    lines.push(`Cliente: ${record.clientName.trim()}${role}${company}`);
  }
  if (record.industry?.trim()) lines.push(`Industria: ${record.industry.trim()}`);
  if (record.productSold?.trim()) lines.push(`Producto/servicio: ${record.productSold.trim()}`);
  if (record.clientProblem?.trim()) lines.push(`Problema: ${record.clientProblem.trim()}`);

  const objections = (record.objections ?? []).map((item) => item.trim()).filter(Boolean);
  if (objections.length > 0) {
    lines.push(`Objeciones: ${objections.map((item) => `- ${item}`).join(" ")}`);
  }
  if (record.winCriteria?.trim()) {
    lines.push(`Criterio de éxito: ${record.winCriteria.trim()}`);
  }

  const guides = Object.entries(record.config.dimensionGuides ?? {}).filter(
    ([, value]) => value?.trim(),
  );
  if (guides.length > 0) {
    lines.push("Guías de evaluación:");
    for (const [id, value] of guides) {
      lines.push(`- ${dimensionLabel(id)}: ${value!.trim()}`);
    }
  }

  return lines.join("\n").trim();
}

function loadPracticeBriefFromBuilderDraft(): string | null {
  const stored = loadAnyBuilderDraftFromStorage();
  if (!stored) return null;
  const brief = buildPracticeBriefFromAuthoringDraft(stored.draft);
  return brief.length >= MIN_SCENARIO_CONTEXT_CHARS ? brief : null;
}

function loadPracticeBriefFromLocalScenario(): string | null {
  const scenarios = loadLocalCustomScenarios();
  const preferred =
    scenarios.find((record) => /valeria/i.test(record.clientName)) ?? scenarios[0];
  if (!preferred) return null;
  const brief = buildPracticeBriefFromScenarioRecord(preferred);
  return brief.length >= MIN_SCENARIO_CONTEXT_CHARS ? brief : null;
}

function activeProjectContextText(draft: Partial<KrakenLabCohortConfig>): string {
  const project = resolveActiveProject(draft);
  return fullScenarioContextText(getProjectContextPack(draft, project));
}

function applySeededContext(
  draft: Partial<KrakenLabCohortConfig>,
  scenarioContext: NonNullable<KrakenLabCohortConfig["scenarioContext"]>,
  contextIndustry?: string,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  const existingIndustry = getProjectIndustry(draft, project);
  const industry =
    existingIndustry ||
    contextIndustry?.trim() ||
    inferContextIndustryFromBrief(scenarioContext.text ?? "") ||
    "";

  return updateActiveProjectIndustryPack(
    updateActiveProjectScenarioContext(draft, scenarioContext),
    industry,
    scenarioContext,
  );
}

export function seedWizardScenarioContextFromPriorPractice(
  draft: Partial<KrakenLabCohortConfig>,
): { draft: Partial<KrakenLabCohortConfig>; seeded: boolean } {
  if (activeProjectContextText(draft).trim().length >= MIN_SCENARIO_CONTEXT_CHARS) {
    return { draft, seeded: false };
  }

  const project = resolveActiveProject(draft);
  const activeContext = getProjectContextPack(draft, project);
  const storedWizard = loadWizardDraftFromStorage();
  if (
    storedWizard &&
    wizardDraftHasScenarioContextContent(storedWizard.draft) &&
    fullScenarioContextText(storedWizard.draft.scenarioContext).trim().length >=
      MIN_SCENARIO_CONTEXT_CHARS
  ) {
    const mergedContext = mergeScenarioContextUpload(
      activeContext,
      storedWizard.draft.scenarioContext,
    );
    return {
      draft: applySeededContext(
        draft,
        mergedContext,
        storedWizard.draft.contextIndustry ??
          inferContextIndustryFromBrief(storedWizard.draft.scenarioContext?.text ?? ""),
      ),
      seeded: true,
    };
  }

  const builderBrief = loadPracticeBriefFromBuilderDraft();
  if (builderBrief) {
    const stored = loadAnyBuilderDraftFromStorage();
    const mergedContext = mergeScenarioContextUpload(
      {
        ...activeContext,
        text: builderBrief,
      },
      storedWizard?.draft.scenarioContext ?? activeContext,
    );
    return {
      draft: applySeededContext(
        draft,
        mergedContext,
        stored?.draft.industry ?? inferContextIndustryFromBrief(builderBrief),
      ),
      seeded: true,
    };
  }

  const scenarioBrief = loadPracticeBriefFromLocalScenario();
  if (scenarioBrief) {
    const preferred =
      loadLocalCustomScenarios().find((record) => /valeria/i.test(record.clientName)) ??
      loadLocalCustomScenarios()[0];
    const mergedContext = mergeScenarioContextUpload(
      {
        ...activeContext,
        text: scenarioBrief,
      },
      storedWizard?.draft.scenarioContext ?? activeContext,
    );
    return {
      draft: applySeededContext(
        draft,
        mergedContext,
        preferred?.industry ?? inferContextIndustryFromBrief(scenarioBrief),
      ),
      seeded: true,
    };
  }

  return { draft, seeded: false };
}

export function shouldOfferPriorPracticeContextSeed(
  draft: Partial<KrakenLabCohortConfig>,
): boolean {
  return activeProjectContextText(draft).trim().length < MIN_SCENARIO_CONTEXT_CHARS;
}
