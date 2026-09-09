import type { PracticeMode } from "@/lib/db/types";
import type { WizardStep } from "./constants";
import { WIZARD_STEPS } from "./constants";
import type { KrakenLabCohortConfig, PasanteProfile, ScenarioContextUpload } from "./types";
import {
  draftHasAnyProjectContextContent,
  mergeProjectContextPacks,
  migrateLegacyProjectContextPacks,
  prepareWizardDraftForStorage,
} from "./project-context-packs";
import { defaultCohortDraft } from "./validation";

export const KRAKEN_WIZARD_DRAFT_STORAGE_KEY = "kraken-simulacion:wizard-draft:v1";

export interface PersistedWizardDraft {
  version: 1;
  step: WizardStep;
  mode: PracticeMode;
  draft: Partial<KrakenLabCohortConfig>;
  savedAt: string;
  trimmedFileBodies?: boolean;
}

export interface SaveWizardDraftResult {
  ok: boolean;
  trimmed?: boolean;
  error?: string;
}

function canUseStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === "string" && (WIZARD_STEPS as readonly string[]).includes(value);
}

function isPracticeMode(value: unknown): value is PracticeMode {
  return value === "voz" || value === "texto";
}

function normalizeScenarioContext(value: unknown): ScenarioContextUpload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as ScenarioContextUpload;
  const files = Array.isArray(raw.files)
    ? raw.files
        .filter(
          (file): file is NonNullable<ScenarioContextUpload["files"]>[number] =>
            Boolean(file && typeof file === "object" && typeof file.name === "string"),
        )
        .map((file) => ({
          id: String(file.id ?? file.name),
          name: file.name,
          text: typeof file.text === "string" ? file.text : "",
        }))
    : undefined;

  return {
    text: typeof raw.text === "string" ? raw.text : "",
    fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
    uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : undefined,
    files,
  };
}

function normalizeParticipant(value: unknown): PasanteProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as PasanteProfile;
  if (typeof raw.fullName !== "string") return null;
  return {
    fullName: raw.fullName,
    age: Number.isFinite(raw.age) ? raw.age : 22,
    city: typeof raw.city === "string" ? raw.city : "",
    simulationCities: Array.isArray(raw.simulationCities)
      ? raw.simulationCities.filter((city): city is string => typeof city === "string")
      : [],
    phone: typeof raw.phone === "string" ? raw.phone : "",
    email: typeof raw.email === "string" ? raw.email : "",
    cvFileName: typeof raw.cvFileName === "string" ? raw.cvFileName : undefined,
  };
}

export function wizardDraftHasSavedContent(
  draft: Partial<KrakenLabCohortConfig>,
): boolean {
  if (wizardDraftHasScenarioContextContent(draft)) return true;
  if (wizardDraftHasParticipantsContent(draft)) return true;
  if (draft.roleObjective?.trim()) return true;
  if ((draft.receiverPersonas?.length ?? 0) > 0) return true;
  if (draft.projectOther?.trim()) return true;
  return false;
}

export function wizardDraftHasScenarioContextContent(
  draft: Partial<KrakenLabCohortConfig>,
): boolean {
  return draftHasAnyProjectContextContent(draft);
}

export function wizardDraftHasParticipantsContent(
  draft: Partial<KrakenLabCohortConfig>,
): boolean {
  return (
    draft.participants?.some(
      (profile) =>
        profile.fullName.trim() ||
        profile.email.trim() ||
        profile.phone.trim() ||
        profile.city.trim() ||
        profile.cvFileName,
    ) ?? false
  );
}

export function mergeWizardDraftPreservingRicherFields(
  incoming: Partial<KrakenLabCohortConfig>,
  stored: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const merged = mergeProjectContextPacks(incoming, stored);

  if (
    !wizardDraftHasParticipantsContent(incoming) &&
    wizardDraftHasParticipantsContent(stored)
  ) {
    merged.participants = stored.participants;
    merged.participantCount = stored.participantCount ?? merged.participantCount;
  }

  return merged;
}

export function mergeWizardDraftWithDefaults(
  stored: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const defaults = defaultCohortDraft();
  const normalizedParticipants =
    stored.participants
      ?.map((profile) => normalizeParticipant(profile))
      .filter((profile): profile is PasanteProfile => profile !== null) ?? [];
  const participants =
    normalizedParticipants.length > 0
      ? normalizedParticipants
      : (defaults.participants ?? []);

  const normalizedScenarioContextByProject = stored.scenarioContextByProject
    ? Object.fromEntries(
        Object.entries(stored.scenarioContextByProject)
          .map(([project, context]) => [
            project,
            normalizeScenarioContext(context) ?? { text: "" },
          ])
          .filter(([, context]) => context !== undefined),
      )
    : undefined;

  return migrateLegacyProjectContextPacks({
    ...defaults,
    ...stored,
    scenarioContext: normalizeScenarioContext(stored.scenarioContext) ?? defaults.scenarioContext,
    scenarioContextByProject: normalizedScenarioContextByProject,
    contextIndustry:
      typeof stored.contextIndustry === "string" ? stored.contextIndustry : undefined,
    contextIndustryByProject:
      stored.contextIndustryByProject && typeof stored.contextIndustryByProject === "object"
        ? stored.contextIndustryByProject
        : undefined,
    participants: participants.length > 0 ? participants : (defaults.participants ?? []),
    participantCount: stored.participantCount ?? defaults.participantCount,
    simulationFocuses: stored.simulationFocuses ?? defaults.simulationFocuses,
    dialogueTypes: stored.dialogueTypes ?? defaults.dialogueTypes,
    receiverPersonas: stored.receiverPersonas ?? defaults.receiverPersonas,
    sessionSeed: stored.sessionSeed ?? defaults.sessionSeed,
  });
}

export function serializeWizardDraft(payload: Omit<PersistedWizardDraft, "version" | "savedAt">): PersistedWizardDraft {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    step: payload.step,
    mode: payload.mode,
    draft: payload.draft,
    trimmedFileBodies: payload.trimmedFileBodies,
  };
}

export function hydrateWizardDraft(raw: unknown): PersistedWizardDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as PersistedWizardDraft;
  if (value.version !== 1) return null;
  if (!isWizardStep(value.step) || !isPracticeMode(value.mode)) return null;
  if (!value.draft || typeof value.draft !== "object") return null;

  return {
    version: 1,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    step: value.step,
    mode: value.mode,
    draft: mergeWizardDraftWithDefaults(value.draft),
    trimmedFileBodies: Boolean(value.trimmedFileBodies),
  };
}

export function loadWizardDraftFromStorage(): PersistedWizardDraft | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(KRAKEN_WIZARD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return hydrateWizardDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function trimScenarioFileText(
  context: ScenarioContextUpload | undefined,
): ScenarioContextUpload | undefined {
  if (!context?.files?.length) return context;
  return {
    ...context,
    files: context.files.map((file) => ({
      ...file,
      text: "",
    })),
  };
}

function trimScenarioFileBodies(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const trimmedActive = trimScenarioFileText(draft.scenarioContext);
  const trimmedByProject = draft.scenarioContextByProject
    ? Object.fromEntries(
        Object.entries(draft.scenarioContextByProject).map(([project, context]) => [
          project,
          trimScenarioFileText(context) ?? context,
        ]),
      )
    : undefined;

  if (!trimmedActive && !trimmedByProject) return draft;

  return {
    ...draft,
    ...(trimmedActive ? { scenarioContext: trimmedActive } : {}),
    ...(trimmedByProject ? { scenarioContextByProject: trimmedByProject } : {}),
  };
}

function writeDraft(raw: PersistedWizardDraft): void {
  localStorage.setItem(KRAKEN_WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(raw));
}

export function saveWizardDraftToStorage(input: {
  step: WizardStep;
  mode: PracticeMode;
  draft: Partial<KrakenLabCohortConfig>;
}): SaveWizardDraftResult {
  if (!canUseStorage()) {
    return { ok: false, error: "storage_unavailable" };
  }

  const stored = loadWizardDraftFromStorage();
  const mergedDraft =
    stored && wizardDraftHasSavedContent(stored.draft)
      ? mergeWizardDraftPreservingRicherFields(input.draft, stored.draft)
      : input.draft;
  const draftToSave = prepareWizardDraftForStorage(mergedDraft);

  const payload = serializeWizardDraft({
    step: input.step,
    mode: input.mode,
    draft: draftToSave,
  });

  try {
    writeDraft(payload);
    return { ok: true };
  } catch (error) {
    const isQuota =
      error instanceof DOMException
        ? error.name === "QuotaExceededError"
        : false;
    if (!isQuota) {
      return { ok: false, error: "save_failed" };
    }
  }

  try {
    const trimmedDraft = trimScenarioFileBodies(draftToSave);
    writeDraft(
      serializeWizardDraft({
        step: input.step,
        mode: input.mode,
        draft: trimmedDraft,
        trimmedFileBodies: true,
      }),
    );
    return { ok: true, trimmed: true };
  } catch {
    return { ok: false, error: "quota_exceeded" };
  }
}

export function clearWizardDraftFromStorage(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(KRAKEN_WIZARD_DRAFT_STORAGE_KEY);
}

export function participantCountChangeNeedsConfirm(
  currentCount: number,
  nextCount: number,
  participants: PasanteProfile[] | undefined,
): boolean {
  if (nextCount >= currentCount) return false;
  return (participants?.length ?? 0) > nextCount;
}
