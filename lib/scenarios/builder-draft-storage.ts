import {
  AUTHORING_STEPS,
  type AuthoringStep,
  type ScenarioAuthoringDraft,
} from "./authoring";
import {
  isScenarioCallType,
  isScenarioLanguage,
  type ScenarioRoundDef,
} from "./types";

export const SCENARIO_BUILDER_DRAFT_STORAGE_KEY = "simulador:scenario-builder-draft:v1";

export interface PersistedBuilderDraft {
  version: 1;
  draftKey: string;
  step: AuthoringStep;
  draft: ScenarioAuthoringDraft;
  savedAt: string;
}

function canUseStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function isAuthoringStep(value: unknown): value is AuthoringStep {
  return typeof value === "string" && (AUTHORING_STEPS as readonly string[]).includes(value);
}

function normalizeRound(value: unknown): ScenarioRoundDef | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as ScenarioRoundDef;
  if (typeof raw.label !== "string") return null;
  return {
    key: typeof raw.key === "string" ? raw.key : "",
    label: raw.label,
    goal: typeof raw.goal === "string" ? raw.goal : "",
    clientPrompt: typeof raw.clientPrompt === "string" ? raw.clientPrompt : "",
    positiveCriteria: Array.isArray(raw.positiveCriteria)
      ? raw.positiveCriteria.filter((item): item is string => typeof item === "string")
      : [],
    negativeCriteria: Array.isArray(raw.negativeCriteria)
      ? raw.negativeCriteria.filter((item): item is string => typeof item === "string")
      : [],
    whatGoodLooksLike:
      typeof raw.whatGoodLooksLike === "string" ? raw.whatGoodLooksLike : "",
  };
}

function normalizeDraft(value: unknown): ScenarioAuthoringDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as ScenarioAuthoringDraft;
  if (
    typeof raw.clientName !== "string" ||
    typeof raw.winCriteria !== "string" ||
    !isScenarioLanguage(raw.language) ||
    !isScenarioCallType(raw.callType)
  ) {
    return null;
  }

  const rounds = Array.isArray(raw.rounds)
    ? raw.rounds
        .map(normalizeRound)
        .filter((round): round is ScenarioRoundDef => round !== null)
    : [];

  const dimensionGuides =
    raw.dimensionGuides && typeof raw.dimensionGuides === "object"
      ? Object.fromEntries(
          Object.entries(raw.dimensionGuides).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    industry: typeof raw.industry === "string" ? raw.industry : "",
    productSold: typeof raw.productSold === "string" ? raw.productSold : "",
    clientName: raw.clientName,
    clientTitle: typeof raw.clientTitle === "string" ? raw.clientTitle : "",
    companyContext: typeof raw.companyContext === "string" ? raw.companyContext : "",
    temperament: typeof raw.temperament === "string" ? raw.temperament : "",
    difficultyLabel: typeof raw.difficultyLabel === "string" ? raw.difficultyLabel : "",
    clientProblem: typeof raw.clientProblem === "string" ? raw.clientProblem : "",
    objections: Array.isArray(raw.objections)
      ? raw.objections.filter((item): item is string => typeof item === "string")
      : [],
    winCriteria: raw.winCriteria,
    language: raw.language,
    callType: raw.callType,
    rounds,
    dimensionGuides,
  };
}

export function builderDraftKey(slug?: string | null): string {
  return slug?.trim() ? slug.trim() : "new";
}

export function builderDraftHasSavedContent(draft: ScenarioAuthoringDraft): boolean {
  const textFields = [
    draft.industry,
    draft.productSold,
    draft.clientName,
    draft.clientTitle,
    draft.companyContext,
    draft.temperament,
    draft.difficultyLabel,
    draft.clientProblem,
    draft.winCriteria,
    ...draft.objections,
    ...draft.rounds.flatMap((round) => [
      round.label,
      round.goal,
      round.clientPrompt,
      round.whatGoodLooksLike ?? "",
    ]),
    ...Object.values(draft.dimensionGuides ?? {}),
  ];

  return textFields.some((value) => value.trim().length > 0);
}

function parseBuilderDraftEnvelope(
  raw: string,
  draftKey?: string,
): PersistedBuilderDraft | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const envelope = parsed as Partial<PersistedBuilderDraft>;
    if (envelope.version !== 1) return null;
    if (draftKey && envelope.draftKey !== draftKey) return null;
    if (!isAuthoringStep(envelope.step)) return null;

    const draft = normalizeDraft(envelope.draft);
    if (!draft) return null;

    return {
      version: 1,
      draftKey: envelope.draftKey ?? draftKey ?? "new",
      step: envelope.step,
      draft,
      savedAt: typeof envelope.savedAt === "string" ? envelope.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadAnyBuilderDraftFromStorage(): PersistedBuilderDraft | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(SCENARIO_BUILDER_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  return parseBuilderDraftEnvelope(raw);
}

export function loadBuilderDraftFromStorage(
  draftKey: string,
): PersistedBuilderDraft | null {
  if (!canUseStorage()) return null;

  const raw = localStorage.getItem(SCENARIO_BUILDER_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  return parseBuilderDraftEnvelope(raw, draftKey);
}

export function saveBuilderDraftToStorage(input: {
  draftKey: string;
  step: AuthoringStep;
  draft: ScenarioAuthoringDraft;
}): void {
  if (!canUseStorage()) return;

  const payload: PersistedBuilderDraft = {
    version: 1,
    draftKey: input.draftKey,
    step: input.step,
    draft: input.draft,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(SCENARIO_BUILDER_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function clearBuilderDraftFromStorage(draftKey: string): void {
  if (!canUseStorage()) return;

  const stored = loadBuilderDraftFromStorage(draftKey);
  if (stored) {
    localStorage.removeItem(SCENARIO_BUILDER_DRAFT_STORAGE_KEY);
  }
}
