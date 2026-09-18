import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import type { ScenarioCallType } from "@/lib/scenarios/types";

/**
 * Trainer-facing knobs for the live client layer.
 * The full PACK is built from the case; these are the few options a
 * facilitator who is not a software person needs to set.
 */
export const CLIENT_TONE_IDS = [
  "auto",
  "molesto",
  "intriga",
  "desconfianza",
  "prepotencia",
  "suave",
  "amigable",
] as const;
export type ClientToneId = (typeof CLIENT_TONE_IDS)[number];

export const DECISION_ROLES = [
  "decisor",
  "influenciador",
  "guardian",
] as const;
export type DecisionRole = (typeof DECISION_ROLES)[number];

export const CLIENT_LAYER_ENGINES = [
  {
    id: "grounding",
    title: "Hechos del caso",
    body: "El cliente solo usa datos del pack. No inventa cifras ni nombres.",
  },
  {
    id: "persona",
    title: "Persona y tono",
    body: "Habla como esa persona, con el tono que elijas o el del personaje.",
  },
  {
    id: "dialogo",
    title: "Diálogo en vivo",
    body: "Una réplica corta por turno. Recuerda lo que ya aceptó.",
  },
  {
    id: "coach",
    title: "Coach aparte",
    body: "El coaching es para el vendedor. Nunca habla con la voz del cliente.",
  },
] as const;

export interface ClientLayerSettings {
  /** Motor mode: live client, not a cloned script, when a model is available. */
  motorEnabled: boolean;
  toneId: ClientToneId;
}

export const DEFAULT_CLIENT_LAYER_SETTINGS: ClientLayerSettings = {
  motorEnabled: true,
  toneId: "auto",
};

export const CLIENT_TONE_LABELS: Record<ClientToneId, string> = {
  auto: "Según personaje",
  molesto: "Molesto",
  intriga: "Con intriga",
  desconfianza: "Desconfiado",
  prepotencia: "Prepotente",
  suave: "Suave",
  amigable: "Amigable",
};

export function isClientToneId(value: string): value is ClientToneId {
  return (CLIENT_TONE_IDS as readonly string[]).includes(value);
}

export function isDecisionRole(value: string): value is DecisionRole {
  return (DECISION_ROLES as readonly string[]).includes(value);
}

export function snapshotSessionConfig(input: {
  clientLayer: ClientLayerSettings;
  language: "es" | "en";
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
}): {
  clientLayer: ClientLayerSettings;
  language: "es" | "en";
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
} {
  return {
    clientLayer: parseClientLayerSettings(input.clientLayer),
    language: input.language === "en" ? "en" : "es",
    difficultyLevel: input.difficultyLevel,
    mode: input.mode,
  };
}

export function parseClientLayerSettings(raw: unknown): ClientLayerSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CLIENT_LAYER_SETTINGS };
  }
  const source = raw as Record<string, unknown>;
  const tone =
    typeof source.toneId === "string" && isClientToneId(source.toneId)
      ? source.toneId
      : "auto";
  return {
    motorEnabled: source.motorEnabled !== false,
    toneId: tone,
  };
}

/** App difficulty 1–3 → Jaime 1–5 (same mapping as his v3 motor). */
export function mapDifficultyToJaime(level: DifficultyLevel): 1 | 2 | 3 | 4 | 5 {
  if (level <= 1) return 2;
  if (level === 2) return 3;
  return 5;
}

export function encounterFromCallType(
  callType?: ScenarioCallType | null,
): "fria" | "seguimiento" | "presentacion" {
  if (callType === "discovery") return "seguimiento";
  if (callType === "cierre") return "presentacion";
  return "fria";
}

export function channelFromMode(mode?: PracticeMode | null): "voz" | "texto" {
  return mode === "texto" ? "texto" : "voz";
}

export interface ClientScenarioPack {
  channel: "voz" | "texto";
  encounterType: "fria" | "seguimiento" | "presentacion";
  sellerObjective: string;
  difficultyJaime: 1 | 2 | 3 | 4 | 5;
  maxTurns: number;
  country: string;
  register: string;
  clientName: string;
  clientTitle: string;
  decisionRole: DecisionRole;
  company: string;
  industry: string;
  temperament: string;
  howTheyWorkToday: string;
  unspokenPains: string[];
  onTheirMind: string;
  productSold: string;
  allowedFacts: string[];
  forbiddenClaims: string[];
  surfaceObjections: string[];
  realObjection: string;
  grantConditions: string;
  winCriteria: string;
}

export interface CatalogClientPackSeed {
  decisionRole: DecisionRole;
  howTheyWorkToday: string;
  onTheirMind: string;
  allowedFacts: string[];
  forbiddenClaims: string[];
  realObjection: string;
  grantConditions: string;
  sellerObjective: string;
}

export function toneHint(toneId: ClientToneId, temperament: string): string {
  switch (toneId) {
    case "auto":
      return temperament;
    case "molesto":
      return "Molesto, respuestas cortas, poco tiempo";
    case "intriga":
      return "Curioso a regañadientes; pide un ejemplo concreto";
    case "desconfianza":
      return "Desconfiado; verifica de dónde sacó el dato";
    case "prepotencia":
      return "Prepotente; hace sentir que su tiempo vale más";
    case "suave":
      return "Suave pero no fácil; concede poco";
    case "amigable":
      return "Cercano, aún así cuida su agenda";
    default: {
      const _exhaustive: never = toneId;
      return _exhaustive;
    }
  }
}
