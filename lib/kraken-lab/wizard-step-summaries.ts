import type { PracticeMode } from "@/lib/db/types";
import {
  DIFFICULTY_DESCRIPTIONS,
  KRAKEN_PROJECT_LABELS,
  SIMULATION_FOCUS_LABELS,
  SIMULATOR_ROLE_LABELS,
  type WizardStep,
} from "./constants";
import { getProjectContextPack, projectContextHasContent } from "./project-context-packs";
import { fullScenarioContextText } from "./scenario-context";
import type { KrakenLabCohortConfig, KrakenLabProject } from "./types";
import { DIFFICULTY_LABELS, MODE_LABELS } from "@/lib/frontend/training-readiness";

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function projectLabel(
  project: KrakenLabCohortConfig["project"] | undefined,
  projectOther?: string,
): string {
  if (!project) return "";
  if (project === "otro") return projectOther?.trim() || KRAKEN_PROJECT_LABELS.otro;
  return KRAKEN_PROJECT_LABELS[project];
}

export function summarizeKrakenWizardStep(
  step: WizardStep,
  draft: Partial<KrakenLabCohortConfig>,
  mode: PracticeMode,
  activeProject?: KrakenLabProject,
): string {
  switch (step) {
    case "proyecto": {
      const project = activeProject ?? draft.project;
      const label = projectLabel(project, draft.projectOther);
      const pack = getProjectContextPack(
        draft,
        project ?? draft.project ?? "simulador-llamadas",
      );
      const contextSource = projectContextHasContent(pack)
        ? pack
        : draft.scenarioContext;
      const text = fullScenarioContextText(contextSource);
      const fileCount = contextSource?.files?.length ?? 0;
      const parts: string[] = [];
      if (label) parts.push(label);
      if (text) parts.push(`Contexto: ${truncate(text, 72)}`);
      if (fileCount > 0) parts.push(`${fileCount} archivo(s)`);
      return parts.join(" · ");
    }
    case "participantes": {
      const count = draft.participantCount ?? 0;
      if (count <= 0) return "";
      return `${count} participante(s) · Modo ${MODE_LABELS[mode]}`;
    }
    case "perfiles": {
      const participants = draft.participants ?? [];
      const names = participants.map((participant) => participant.fullName.trim()).filter(Boolean);
      if (names.length === 0) return "";
      const preview = names.slice(0, 3).join(", ");
      return `${names.length} perfil(es): ${preview}${names.length > 3 ? "…" : ""}`;
    }
    case "simulacion": {
      const focuses = (draft.simulationFocuses ?? [])
        .map((focus) =>
          focus === "otro"
            ? draft.simulationFocusOther?.trim() || SIMULATION_FOCUS_LABELS.otro
            : SIMULATION_FOCUS_LABELS[focus],
        )
        .filter(Boolean);
      return focuses.join(" · ");
    }
    case "rol": {
      const role = draft.simulatorRole
        ? SIMULATOR_ROLE_LABELS[draft.simulatorRole]
        : "";
      const objective = draft.roleObjective?.trim();
      if (!role && !objective) return "";
      if (role && objective) return `${role} · ${truncate(objective, 60)}`;
      return role || truncate(objective ?? "", 80);
    }
    case "dialogos": {
      const dialogues = draft.dialogueTypes ?? [];
      const parts = dialogues
        .map((dialogue) => {
          const focus =
            dialogue.focus === "otro"
              ? dialogue.focusOther?.trim() || SIMULATION_FOCUS_LABELS.otro
              : SIMULATION_FOCUS_LABELS[dialogue.focus];
          const product = dialogue.productServiceExplanation.trim();
          const context = dialogue.simulationContext.trim();
          if (product) return `${focus}: ${truncate(product, 48)}`;
          if (context) return `${focus}: ${truncate(context, 48)}`;
          return focus;
        })
        .filter(Boolean);
      return parts.join(" · ");
    }
    case "personas": {
      const personas = draft.receiverPersonas ?? [];
      if (personas.length === 0) return "";
      const selected =
        personas.find((persona) => persona.id === draft.selectedPersonaId) ?? personas[0];
      if (selected) {
        return `${selected.name} · ${selected.role}${personas.length > 1 ? ` (+${personas.length - 1} más)` : ""}`;
      }
      return personas.map((persona) => persona.name).join(", ");
    }
    case "dificultad": {
      const level = draft.difficultyLevel;
      if (!level) return "";
      return `${DIFFICULTY_LABELS[level]} · ${DIFFICULTY_DESCRIPTIONS[level]}`;
    }
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
