import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioConfig } from "@/lib/scenarios/types";

export const KRAKEN_LAB_PROJECTS = [
  "me-we",
  "global-green",
  "simulador-llamadas",
  "clinica-citas",
  "dominion-ark",
  "kraken-flow",
  "otro",
] as const;

export type KrakenLabProject = (typeof KRAKEN_LAB_PROJECTS)[number];

export const SIMULATION_FOCUSES = [
  "ventas",
  "speech-rapido",
  "seguimiento",
  "motivacion-personal",
  "otro",
] as const;

export type SimulationFocus = (typeof SIMULATION_FOCUSES)[number];

export const SIMULATOR_ROLES = ["caller", "receiver", "both", "custom"] as const;
export type SimulatorRole = (typeof SIMULATOR_ROLES)[number];

export const ATTENTION_STATES = [
  "ocupado",
  "ya_tiene_proveedor",
  "escuchando",
  "esceptico",
  "gatekeeper",
  "interesado",
  "impaciente",
] as const;

export type AttentionState = (typeof ATTENTION_STATES)[number];

export const RECEIVER_GENDERS = ["masculino", "femenino", "otro"] as const;
export type ReceiverGender = (typeof RECEIVER_GENDERS)[number];

export interface PasanteProfile {
  fullName: string;
  age: number;
  city: string;
  simulationCities: string[];
  phone: string;
  email: string;
}

export interface DialogueTypeConfig {
  focus: SimulationFocus | "otro";
  focusOther?: string;
  simulationContext: string;
  realObjective: string;
  productServiceExplanation: string;
}

export interface ReceiverPersona {
  id: string;
  name: string;
  age: number;
  gender: ReceiverGender;
  role: string;
  company: string;
  city: string;
  moods: string[];
  homeStress: number;
  workStress: number;
  attentionStates: AttentionState[];
  extras: {
    industry: string;
    objectionStyle: string;
    patienceLevel: string;
  };
}

export interface KrakenLabCohortConfig {
  id?: string;
  project: KrakenLabProject;
  projectOther?: string;
  participantCount: number;
  participants: PasanteProfile[];
  simulationFocuses: SimulationFocus[];
  simulationFocusOther?: string;
  simulatorRole: SimulatorRole;
  roleObjective: string;
  dialogueTypes: DialogueTypeConfig[];
  receiverPersonas: ReceiverPersona[];
  difficultyLevel: DifficultyLevel;
  /** Deterministic seed for dialogue battery generation. */
  sessionSeed: string;
  createdAt?: string;
}

export interface KrakenLabScenarioMeta {
  cohortId: string;
  sessionSeed: string;
  project: KrakenLabProject;
  simulatorRole: SimulatorRole;
  roleObjective: string;
  simulationFocuses: SimulationFocus[];
  selectedPersonaId: string;
  attentionBattery: AttentionState[];
  difficultyLevel: DifficultyLevel;
}

export interface KrakenLabScenarioConfig extends ScenarioConfig {
  krakenLab?: KrakenLabScenarioMeta;
}

export interface GeneratedKrakenScenario {
  slug: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  difficultyLabel: string;
  indicator: string;
  config: KrakenLabScenarioConfig;
}

export interface SaveCohortResult {
  cohortId: string;
  config: KrakenLabCohortConfig;
}

export interface StartKrakenSessionResult {
  cohortId: string;
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  clientName: string;
  totalRounds: number;
  config: KrakenLabScenarioConfig;
}
