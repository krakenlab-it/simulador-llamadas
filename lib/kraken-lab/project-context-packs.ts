import type {
  KrakenLabCohortConfig,
  KrakenLabProject,
  ScenarioContextUpload,
} from "./types";
import { KRAKEN_LAB_PROJECTS } from "./types";
import { emptyScenarioContext, fullScenarioContextText } from "./scenario-context";
import { mergeScenarioContextUpload } from "./context-from-industry";

export function resolveActiveProject(
  draft: Partial<KrakenLabCohortConfig>,
): KrakenLabProject {
  if (draft.project && KRAKEN_LAB_PROJECTS.includes(draft.project)) {
    return draft.project;
  }
  return "simulador-llamadas";
}

export function getProjectContextPack(
  draft: Partial<KrakenLabCohortConfig>,
  project: KrakenLabProject,
): ScenarioContextUpload {
  return draft.scenarioContextByProject?.[project] ?? emptyScenarioContext();
}

export function getProjectIndustry(
  draft: Partial<KrakenLabCohortConfig>,
  project: KrakenLabProject,
): string {
  return draft.contextIndustryByProject?.[project]?.trim() ?? "";
}

export function projectContextHasContent(context: ScenarioContextUpload | undefined): boolean {
  if (!context) return false;
  if (fullScenarioContextText(context).trim().length > 0) return true;
  return (context.files?.length ?? 0) > 0;
}

export function draftHasAnyProjectContextContent(
  draft: Partial<KrakenLabCohortConfig>,
): boolean {
  if (draft.scenarioContextByProject) {
    for (const context of Object.values(draft.scenarioContextByProject)) {
      if (projectContextHasContent(context)) return true;
    }
  }
  return projectContextHasContent(draft.scenarioContext);
}

export function syncActiveProjectContextToDraft(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  const context = getProjectContextPack(draft, project);
  const industry = getProjectIndustry(draft, project);

  return {
    ...draft,
    scenarioContext: context,
    contextIndustry: industry || undefined,
  };
}

export function persistActiveProjectContextPack(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  const context = draft.scenarioContext ?? emptyScenarioContext();
  const industry = draft.contextIndustry?.trim() ?? "";

  const scenarioContextByProject = {
    ...(draft.scenarioContextByProject ?? {}),
    [project]: context,
  };

  const contextIndustryByProject = { ...(draft.contextIndustryByProject ?? {}) };
  if (industry) {
    contextIndustryByProject[project] = industry;
  }

  return {
    ...draft,
    scenarioContextByProject,
    contextIndustryByProject,
    scenarioContext: context,
    contextIndustry: industry || undefined,
  };
}

export function switchProjectContextPack(
  draft: Partial<KrakenLabCohortConfig>,
  nextProject: KrakenLabProject,
): Partial<KrakenLabCohortConfig> {
  const currentProject = resolveActiveProject(draft);
  const withSaved = persistActiveProjectContextPack({
    ...draft,
    project: currentProject,
  });

  if (currentProject === nextProject) {
    return syncActiveProjectContextToDraft({ ...withSaved, project: nextProject });
  }

  return syncActiveProjectContextToDraft({
    ...withSaved,
    project: nextProject,
  });
}

export function updateActiveProjectScenarioContext(
  draft: Partial<KrakenLabCohortConfig>,
  scenarioContext: ScenarioContextUpload,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  return {
    ...draft,
    scenarioContext,
    scenarioContextByProject: {
      ...(draft.scenarioContextByProject ?? {}),
      [project]: scenarioContext,
    },
  };
}

export function updateActiveProjectIndustryPack(
  draft: Partial<KrakenLabCohortConfig>,
  industry: string,
  scenarioContext: ScenarioContextUpload,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  const trimmedIndustry = industry.trim();
  const contextIndustryByProject = { ...(draft.contextIndustryByProject ?? {}) };
  if (trimmedIndustry) {
    contextIndustryByProject[project] = trimmedIndustry;
  } else {
    delete contextIndustryByProject[project];
  }

  return {
    ...draft,
    contextIndustry: trimmedIndustry || undefined,
    scenarioContext,
    scenarioContextByProject: {
      ...(draft.scenarioContextByProject ?? {}),
      [project]: scenarioContext,
    },
    contextIndustryByProject,
  };
}

export function migrateLegacyProjectContextPacks(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const project = resolveActiveProject(draft);
  const existingPacks = draft.scenarioContextByProject ?? {};
  const hasAnyPack = Object.values(existingPacks).some((context) =>
    projectContextHasContent(context),
  );

  if (hasAnyPack) {
    return syncActiveProjectContextToDraft(draft);
  }

  const legacyHasContent = projectContextHasContent(draft.scenarioContext);
  const legacyIndustry = draft.contextIndustry?.trim() ?? "";

  if (!legacyHasContent && !legacyIndustry) {
    return syncActiveProjectContextToDraft(draft);
  }

  return syncActiveProjectContextToDraft({
    ...draft,
    scenarioContextByProject: {
      ...existingPacks,
      ...(legacyHasContent
        ? { [project]: draft.scenarioContext ?? emptyScenarioContext() }
        : {}),
    },
    contextIndustryByProject: {
      ...(draft.contextIndustryByProject ?? {}),
      ...(legacyIndustry ? { [project]: legacyIndustry } : {}),
    },
  });
}

export function mergeProjectContextPacks(
  incoming: Partial<KrakenLabCohortConfig>,
  stored: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  const incomingPrepared = persistActiveProjectContextPack(
    migrateLegacyProjectContextPacks(incoming),
  );
  const storedPrepared = migrateLegacyProjectContextPacks(stored);

  const projectKeys = new Set<KrakenLabProject>([
    ...KRAKEN_LAB_PROJECTS.filter(
      (project) =>
        incomingPrepared.scenarioContextByProject?.[project] ||
        storedPrepared.scenarioContextByProject?.[project],
    ),
  ]);

  const scenarioContextByProject: Partial<
    Record<KrakenLabProject, ScenarioContextUpload>
  > = {
    ...(storedPrepared.scenarioContextByProject ?? {}),
  };

  for (const project of projectKeys) {
    scenarioContextByProject[project] = mergeScenarioContextUpload(
      incomingPrepared.scenarioContextByProject?.[project],
      storedPrepared.scenarioContextByProject?.[project],
    );
  }

  const activeProject = resolveActiveProject(incomingPrepared);
  scenarioContextByProject[activeProject] = mergeScenarioContextUpload(
    incomingPrepared.scenarioContext,
    scenarioContextByProject[activeProject],
  );

  const contextIndustryByProject = {
    ...(storedPrepared.contextIndustryByProject ?? {}),
    ...(incomingPrepared.contextIndustryByProject ?? {}),
  };
  if (incomingPrepared.contextIndustry?.trim()) {
    contextIndustryByProject[activeProject] = incomingPrepared.contextIndustry.trim();
  }

  return syncActiveProjectContextToDraft({
    ...incomingPrepared,
    scenarioContextByProject,
    contextIndustryByProject,
  });
}

export function prepareWizardDraftForStorage(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  return persistActiveProjectContextPack(migrateLegacyProjectContextPacks(draft));
}

export function prepareWizardDraftForSessionStart(
  draft: Partial<KrakenLabCohortConfig>,
): Partial<KrakenLabCohortConfig> {
  return syncActiveProjectContextToDraft(
    persistActiveProjectContextPack(migrateLegacyProjectContextPacks(draft)),
  );
}
