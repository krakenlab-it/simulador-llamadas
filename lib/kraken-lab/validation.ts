import type { DifficultyLevel } from "@/lib/db/types";
import {
  KRAKEN_LAB_PROJECTS,
  SIMULATION_FOCUSES,
  SIMULATOR_ROLES,
  type DialogueTypeConfig,
  type KrakenLabCohortConfig,
  type PasanteProfile,
} from "./types";
import { fullScenarioContextText } from "./scenario-context";
import { WIZARD_STEPS, type WizardStep } from "./constants";

export interface ValidationIssue {
  field: string;
  message: string;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 10;
}

function validatePasante(profile: PasanteProfile, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const prefix = `participants[${index}]`;
  const label = `Participante ${index + 1}`;

  if (!profile.fullName.trim()) {
    issues.push({
      field: `${prefix}.fullName`,
      message: `${label}: Nombre completo requerido`,
    });
  }
  if (!Number.isFinite(profile.age) || profile.age < 16 || profile.age > 80) {
    issues.push({ field: `${prefix}.age`, message: `${label}: Edad entre 16 y 80` });
  }
  if (!profile.city.trim()) {
    issues.push({ field: `${prefix}.city`, message: `${label}: Ciudad requerida` });
  }
  if (profile.phone.trim() && !isPhone(profile.phone)) {
    issues.push({
      field: `${prefix}.phone`,
      message: `${label}: Teléfono válido (10+ dígitos)`,
    });
  }
  if (!isEmail(profile.email)) {
    issues.push({
      field: `${prefix}.email`,
      message: `${label}: Correo válido requerido`,
    });
  }

  return issues;
}

export function validateWizardStep(
  step: WizardStep,
  cohort: Partial<KrakenLabCohortConfig>,
): ValidationIssue[] {
  switch (step) {
    case "proyecto": {
      const issues: ValidationIssue[] = [];
      if (!cohort.project || !KRAKEN_LAB_PROJECTS.includes(cohort.project)) {
        issues.push({ field: "project", message: "Selecciona un proyecto Kraken Simulación" });
      }
      if (cohort.project === "otro" && !cohort.projectOther?.trim()) {
        issues.push({ field: "projectOther", message: "Describe el proyecto" });
      }
      const contextText = fullScenarioContextText(cohort.scenarioContext);
      if (contextText.length < 30) {
        issues.push({
          field: "scenarioContext.text",
          message:
            "Agrega contexto del escenario (mínimo 30 caracteres): producto, objeciones o guion de referencia",
        });
      }
      return issues;
    }
    case "participantes": {
      const count = cohort.participantCount ?? 0;
      if (count < 1 || count > 12) {
        return [{ field: "participantCount", message: "Entre 1 y 12 personas" }];
      }
      return [];
    }
    case "perfiles": {
      const count = cohort.participantCount ?? 1;
      const profiles = cohort.participants ?? [];
      if (profiles.length !== count) {
        return [
          {
            field: "participants",
            message: `Completa los ${count} perfiles de participantes`,
          },
        ];
      }
      return profiles.flatMap((p, i) => validatePasante(p, i));
    }
    case "simulacion": {
      const focuses = cohort.simulationFocuses ?? [];
      if (focuses.length === 0) {
        return [{ field: "simulationFocuses", message: "Selecciona al menos un tipo" }];
      }
      const invalid = focuses.some((f) => !SIMULATION_FOCUSES.includes(f));
      if (invalid) {
        return [{ field: "simulationFocuses", message: "Tipo de simulación inválido" }];
      }
      if (
        focuses.includes("otro" as (typeof focuses)[number]) &&
        !cohort.simulationFocusOther?.trim()
      ) {
        return [{ field: "simulationFocusOther", message: "Describe el tipo «otro»" }];
      }
      return [];
    }
    case "rol": {
      const issues: ValidationIssue[] = [];
      if (!cohort.simulatorRole || !SIMULATOR_ROLES.includes(cohort.simulatorRole)) {
        issues.push({ field: "simulatorRole", message: "Selecciona el rol del simulador" });
      }
      if (!cohort.roleObjective?.trim()) {
        issues.push({ field: "roleObjective", message: "Describe el objetivo de la sesión" });
      }
      return issues;
    }
    case "dialogos": {
      const types = cohort.dialogueTypes ?? [];
      const focuses = cohort.simulationFocuses ?? [];
      if (types.length === 0) {
        return [{ field: "dialogueTypes", message: "Configura al menos un diálogo" }];
      }
      const issues: ValidationIssue[] = [];
      for (const [index, dt] of types.entries()) {
        if (!dt.simulationContext.trim()) {
          issues.push({
            field: `dialogueTypes[${index}].simulationContext`,
            message: "Contexto de simulación requerido",
          });
        }
        if (!dt.realObjective.trim()) {
          issues.push({
            field: `dialogueTypes[${index}].realObjective`,
            message: "Objetivo real requerido",
          });
        }
        if (!dt.productServiceExplanation.trim()) {
          issues.push({
            field: `dialogueTypes[${index}].productServiceExplanation`,
            message: "Explica producto/servicio/motivo",
          });
        }
        if (dt.focus === "otro" && !dt.focusOther?.trim()) {
          issues.push({
            field: `dialogueTypes[${index}].focusOther`,
            message: "Describe el tipo de diálogo",
          });
        }
        if (
          dt.focus !== "otro" &&
          focuses.length > 0 &&
          !focuses.includes(dt.focus)
        ) {
          issues.push({
            field: `dialogueTypes[${index}].focus`,
            message: "El diálogo debe coincidir con lo seleccionado",
          });
        }
      }
      return issues;
    }
    case "personas": {
      const personas = cohort.receiverPersonas ?? [];
      if (personas.length < 3) {
        return [
          {
            field: "receiverPersonas",
            message: "Genera las 3 personas receptoras para esta cohorte",
          },
        ];
      }
      if (!cohort.selectedPersonaId || !personas.some((p) => p.id === cohort.selectedPersonaId)) {
        return [{ field: "selectedPersonaId", message: "Selecciona una persona receptora" }];
      }
      return [];
    }
    case "dificultad": {
      const level = cohort.difficultyLevel;
      if (!level || ![1, 2, 3].includes(level)) {
        return [{ field: "difficultyLevel", message: "Selecciona dificultad 1, 2 o 3" }];
      }
      return [];
    }
    default:
      return [];
  }
}

export function canAdvanceWizardStep(
  step: WizardStep,
  cohort: Partial<KrakenLabCohortConfig>,
): boolean {
  return validateWizardStep(step, cohort).length === 0;
}

export function validateFullCohort(
  cohort: Partial<KrakenLabCohortConfig>,
): ValidationIssue[] {
  return WIZARD_STEPS.flatMap((step) => validateWizardStep(step, cohort));
}

export function isValidCohort(cohort: Partial<KrakenLabCohortConfig>): cohort is KrakenLabCohortConfig {
  return validateFullCohort(cohort).length === 0;
}

export function defaultPasanteProfile(): PasanteProfile {
  return {
    fullName: "",
    age: 0,
    city: "",
    simulationCities: [],
    phone: "",
    email: "",
  };
}

export function defaultDialogueType(focus: DialogueTypeConfig["focus"]): DialogueTypeConfig {
  return {
    focus,
    simulationContext: "",
    realObjective: "",
    productServiceExplanation: "",
  };
}

import { mintFreshSessionSeed } from "./seed";

export function defaultCohortDraft(): Partial<KrakenLabCohortConfig> {
  return {
    project: "simulador-llamadas",
    scenarioContext: { text: "" },
    participantCount: 1,
    participants: [defaultPasanteProfile()],
    simulationFocuses: ["ventas"],
    simulatorRole: "caller",
    roleObjective: "",
    dialogueTypes: [defaultDialogueType("ventas")],
    receiverPersonas: [],
    selectedPersonaId: undefined,
    difficultyLevel: 2 as DifficultyLevel,
    sessionSeed: mintFreshSessionSeed(),
  };
}

export function syncParticipantsToCount(
  cohort: Partial<KrakenLabCohortConfig>,
): PasanteProfile[] {
  const count = Math.min(12, Math.max(1, cohort.participantCount ?? 1));
  const existing = cohort.participants ?? [];
  const next = [...existing];

  while (next.length < count) {
    next.push(defaultPasanteProfile());
  }

  return next.slice(0, count);
}

export function syncDialogueTypesToFocuses(
  cohort: Partial<KrakenLabCohortConfig>,
): DialogueTypeConfig[] {
  const focuses = cohort.simulationFocuses ?? ["ventas"];
  const existing = cohort.dialogueTypes ?? [];
  return focuses.map((focus, index) => {
    const prev = existing.find((d) => d.focus === focus) ?? existing[index];
    return prev ?? defaultDialogueType(focus);
  });
}
