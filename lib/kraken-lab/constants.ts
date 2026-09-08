import type { KrakenLabProject, SimulationFocus } from "./types";

export const KRAKEN_PROJECT_LABELS: Record<KrakenLabProject, string> = {
  "me-we": "Me We",
  "global-green": "Global Green",
  "simulador-llamadas": "Simulador de Llamadas",
  "clinica-citas": "Clínica de Citas",
  "dominion-ark": "Dominion Ark",
  "kraken-flow": "Kraken Flow",
  otro: "Otro",
};

export const SIMULATION_FOCUS_LABELS: Record<SimulationFocus, string> = {
  ventas: "Ventas",
  "speech-rapido": "Speech rápido",
  seguimiento: "Seguimiento",
  "motivacion-personal": "Motivación personal",
  otro: "Otro",
};

export const SIMULATOR_ROLE_LABELS = {
  caller: "Llamador (tú llamas)",
  receiver: "Receptor (contestas la llamada)",
  both: "Ambos (alternas)",
  custom: "Personalizado",
} as const;

export const DIFFICULTY_DESCRIPTIONS = {
  1: "Paciente — pocas objeciones, más tiempo",
  2: "Exigente — objeciones moderadas",
  3: "Difícil — impaciente, gatekeeper, corta rápido",
} as const;

export const ATTENTION_STATE_LABELS = {
  ocupado: "Ocupado",
  ya_tiene_proveedor: "Ya tiene proveedor",
  escuchando: "Escuchando",
  esceptico: "Escéptico",
  gatekeeper: "Gatekeeper",
  interesado: "Interesado",
  impaciente: "Impaciente",
} as const;

export const WIZARD_STEPS = [
  "proyecto",
  "participantes",
  "perfiles",
  "simulacion",
  "rol",
  "dialogos",
  "personas",
  "dificultad",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  proyecto: "Proyecto Kraken Lab",
  participantes: "Tamaño del grupo",
  perfiles: "Perfiles de pasantes",
  simulacion: "Qué simular",
  rol: "Rol del simulador",
  dialogos: "Contexto por diálogo",
  personas: "Personas receptoras",
  dificultad: "Dificultad",
};

export const DEFAULT_MOODS = [
  "ocupado",
  "escéptico",
  "neutral",
  "curioso",
  "impaciente",
  "defensivo",
  "amable pero distraído",
] as const;

export const RECEIVER_ROLES = [
  "Director de compras",
  "Gerente de operaciones",
  "Dueño de PYME",
  "Coordinador de logística",
  "Jefe de mantenimiento",
  "Administrador",
  "Director comercial",
] as const;

export const RECEIVER_INDUSTRIES = [
  "Manufactura",
  "Retail",
  "Servicios",
  "Alimentos y bebidas",
  "Tecnología",
  "Construcción",
  "Salud",
] as const;
