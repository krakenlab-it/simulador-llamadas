/**
 * Demo/back-office persistence for projects and agent assignments.
 * TODO(production): replace with API backed by Supabase + capacitador RBAC.
 */

import { loadLocalHistory } from "@/lib/history/local";
import {
  displayNameFromProfile,
  normalizeAgentProfile,
  type AgentProfile,
} from "@/lib/frontend/agent-profile";

export interface TrainingProject {
  id: string;
  name: string;
  createdAt: string;
}

export interface AgentAssignment {
  id: string;
  projectId: string;
  agentEmail: string;
  /** Kept in sync with profile for legacy UI; prefer profile + displayNameFromProfile. */
  agentDisplayName: string;
  profile: AgentProfile;
  scenarioSlugs: string[];
  requiredSimulations: number;
  /** When false, agente sees progress only — not numeric scorecard. */
  showGradesToAgent: boolean;
}

function hydrateAssignment(assignment: AgentAssignment): AgentAssignment {
  if (assignment.profile?.email) {
    const profile = normalizeAgentProfile({
      ...assignment.profile,
      email: assignment.profile.email || assignment.agentEmail,
    });
    return {
      ...assignment,
      profile,
      agentDisplayName: displayNameFromProfile(
        profile,
        assignment.agentDisplayName,
      ),
    };
  }
  const legacy = assignment.agentDisplayName?.trim() || "Agente";
  const parts = legacy.split(/\s+/);
  const profile = normalizeAgentProfile({
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    age: null,
    email: assignment.agentEmail,
    phone: "",
    cvFileName: null,
    cvUploadedAt: null,
  });
  return {
    ...assignment,
    profile,
    agentDisplayName: displayNameFromProfile(profile, legacy),
  };
}

export interface TrainingOfficeState {
  projects: TrainingProject[];
  assignments: AgentAssignment[];
  activeProjectIdCapacitador: string | null;
  activeProjectIdAgente: string | null;
}

const STORAGE_KEY = "simulador.trainingOffice";

const DEFAULT_PROJECT_ID = "proj-clinica-comercial";

function defaultState(): TrainingOfficeState {
  const now = new Date().toISOString();
  return {
    projects: [
      {
        id: DEFAULT_PROJECT_ID,
        name: "Clínica comercial",
        createdAt: now,
      },
    ],
    assignments: [],
    activeProjectIdCapacitador: DEFAULT_PROJECT_ID,
    activeProjectIdAgente: DEFAULT_PROJECT_ID,
  };
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readTrainingOffice(storage?: Storage): TrainingOfficeState {
  const store = resolveStorage(storage);
  if (!store) return defaultState();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as TrainingOfficeState;
    if (!parsed.projects?.length) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      projects: parsed.projects,
      assignments: (parsed.assignments ?? []).map((row) =>
        hydrateAssignment(row as AgentAssignment),
      ),
    };
  } catch {
    return defaultState();
  }
}

export function writeTrainingOffice(
  state: TrainingOfficeState,
  storage?: Storage,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function activeProject(
  state: TrainingOfficeState,
  role: "capacitador" | "agente",
): TrainingProject {
  const id =
    role === "capacitador"
      ? state.activeProjectIdCapacitador
      : state.activeProjectIdAgente;
  const found = state.projects.find((p) => p.id === id);
  return found ?? state.projects[0];
}

export function setActiveProject(
  state: TrainingOfficeState,
  role: "capacitador" | "agente",
  projectId: string,
): TrainingOfficeState {
  if (role === "capacitador") {
    return { ...state, activeProjectIdCapacitador: projectId };
  }
  return { ...state, activeProjectIdAgente: projectId };
}

export function createProject(state: TrainingOfficeState, name: string): TrainingOfficeState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const project: TrainingProject = {
    id: `proj-${Date.now()}`,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    projects: [...state.projects, project],
    activeProjectIdCapacitador: project.id,
  };
}

export function upsertAssignment(
  state: TrainingOfficeState,
  input: Omit<AgentAssignment, "id" | "profile"> & {
    id?: string;
    profile?: AgentProfile;
  },
): TrainingOfficeState {
  const id = input.id ?? `asg-${Date.now()}`;
  const hydrated = hydrateAssignment({
    ...input,
    id,
    profile: input.profile ?? {
      firstName: "",
      lastName: "",
      age: null,
      email: input.agentEmail,
      phone: "",
    },
  } as AgentAssignment);
  const profile = hydrated.profile;
  const next: AgentAssignment = {
    ...input,
    id,
    profile,
    agentDisplayName: displayNameFromProfile(
      profile,
      input.agentDisplayName,
    ),
  };
  const rest = state.assignments.filter(
    (a) =>
      !(
        a.projectId === next.projectId &&
        a.agentEmail.toLowerCase() === next.agentEmail.toLowerCase()
      ),
  );
  return { ...state, assignments: [...rest, next] };
}

export function assignmentForAgent(
  state: TrainingOfficeState,
  projectId: string,
  agentEmail: string | null | undefined,
): AgentAssignment | null {
  if (!agentEmail) return null;
  const normalized = agentEmail.toLowerCase();
  return (
    state.assignments.find(
      (a) => a.projectId === projectId && a.agentEmail.toLowerCase() === normalized,
    ) ?? null
  );
}

export function countCompletedSimulations(scenarioSlugs: string[]): number {
  const slugSet = new Set(scenarioSlugs);
  const history = loadLocalHistory();
  return history.filter((entry) => slugSet.has(entry.scenarioSlug)).length;
}

export function defaultCapacitadorAssignmentSeed(
  state: TrainingOfficeState,
  presetSlugs: string[],
): TrainingOfficeState {
  if (state.assignments.length > 0) return state;
  const projectId = state.activeProjectIdCapacitador ?? state.projects[0]?.id;
  if (!projectId) return state;
  return upsertAssignment(state, {
    projectId,
    agentEmail: "agente@demo.local",
    agentDisplayName: "Agente demo",
    profile: normalizeAgentProfile({
      firstName: "Agente",
      lastName: "demo",
      age: null,
      email: "agente@demo.local",
      phone: "",
    }),
    scenarioSlugs: presetSlugs.slice(0, 3),
    requiredSimulations: 5,
    showGradesToAgent: true,
  });
}

export function assignmentProfileForAgent(
  state: TrainingOfficeState,
  projectId: string,
  agentEmail: string | null | undefined,
): AgentProfile | null {
  const assignment = assignmentForAgent(state, projectId, agentEmail);
  return assignment?.profile ?? null;
}
