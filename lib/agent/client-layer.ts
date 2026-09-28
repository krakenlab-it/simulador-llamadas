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

export interface ClientLayerEngineCopy {
  title: string;
  body: string;
}

export const CLIENT_LAYER_ENGINES = [
  {
    id: "grounding" as const,
    title: "Hechos del caso",
    body: "El cliente solo usa datos del pack. No inventa cifras ni nombres.",
  },
  {
    id: "persona" as const,
    title: "Persona y tono",
    body: "Habla como esa persona, con el tono que elijas o el del personaje.",
  },
  {
    id: "dialogo" as const,
    title: "Diálogo en vivo",
    body: "Una réplica corta por turno. Recuerda lo que ya aceptó.",
  },
  {
    id: "coach" as const,
    title: "Coach aparte",
    body: "El coaching es para el vendedor. Nunca habla con la voz del cliente.",
  },
] as const;

export type ClientLayerEngineId = (typeof CLIENT_LAYER_ENGINES)[number]["id"];

export interface ClientLayerSettings {
  /** Motor mode: live client, not a cloned script, when a model is available. */
  motorEnabled: boolean;
  toneId: ClientToneId;
  /** Trainer-editable guardrails (IA screen); merged into live client/coach prompts. */
  engineCopy?: Partial<Record<ClientLayerEngineId, ClientLayerEngineCopy>>;
}

const CLIENT_LAYER_ENGINE_IDS: ClientLayerEngineId[] = [
  "grounding",
  "persona",
  "dialogo",
  "coach",
];

function isClientLayerEngineId(value: string): value is ClientLayerEngineId {
  return (CLIENT_LAYER_ENGINE_IDS as readonly string[]).includes(value);
}

function defaultEngineCopy(id: ClientLayerEngineId): ClientLayerEngineCopy {
  const row = CLIENT_LAYER_ENGINES.find((engine) => engine.id === id);
  return {
    title: row?.title ?? id,
    body: row?.body ?? "",
  };
}

export function resolvedClientLayerEngineCopy(
  layer: ClientLayerSettings | null | undefined,
  id: ClientLayerEngineId,
): ClientLayerEngineCopy {
  const override = layer?.engineCopy?.[id];
  const defaults = defaultEngineCopy(id);
  const title =
    typeof override?.title === "string" && override.title.trim()
      ? override.title.trim()
      : defaults.title;
  const body =
    typeof override?.body === "string" && override.body.trim()
      ? override.body.trim()
      : defaults.body;
  return { title, body };
}

/** Guardrails for the live buyer motor (not the seller coach). */
export function buildLiveClientGuardrailsBlock(
  layer: ClientLayerSettings | null | undefined,
): string {
  return (["grounding", "persona", "dialogo"] as const)
    .map((id) => {
      const copy = resolvedClientLayerEngineCopy(layer, id);
      return `${copy.title}: ${copy.body}`;
    })
    .join("\n");
}

export function buildCoachSeparationGuardrail(
  layer: ClientLayerSettings | null | undefined,
): string {
  const copy = resolvedClientLayerEngineCopy(layer, "coach");
  return `${copy.title}: ${copy.body}`;
}

export function mergeClientLayerSettings(
  base?: ClientLayerSettings | null,
  overlay?: ClientLayerSettings | null,
): ClientLayerSettings {
  const parsedBase = parseClientLayerSettings(base);
  const parsedOverlay = parseClientLayerSettings(overlay);
  const engineCopy: Partial<Record<ClientLayerEngineId, ClientLayerEngineCopy>> =
    {};
  for (const id of CLIENT_LAYER_ENGINE_IDS) {
    const merged = {
      ...resolvedClientLayerEngineCopy(parsedBase, id),
      ...parsedOverlay.engineCopy?.[id],
    };
    const defaults = defaultEngineCopy(id);
    if (merged.title !== defaults.title || merged.body !== defaults.body) {
      engineCopy[id] = merged;
    }
  }
  return {
    motorEnabled: parsedBase.motorEnabled,
    toneId: parsedBase.toneId,
    ...(Object.keys(engineCopy).length > 0 ? { engineCopy } : {}),
  };
}

export function patchClientLayerEngineCopy(
  layer: ClientLayerSettings,
  id: ClientLayerEngineId,
  patch: Partial<ClientLayerEngineCopy>,
): ClientLayerSettings {
  const parsed = parseClientLayerSettings(layer);
  const current = resolvedClientLayerEngineCopy(parsed, id);
  const next: ClientLayerEngineCopy = {
    title: patch.title?.trim() ? patch.title.trim() : current.title,
    body: patch.body?.trim() ? patch.body.trim() : current.body,
  };
  const defaults = defaultEngineCopy(id);
  const engineCopy = { ...parsed.engineCopy };
  if (next.title === defaults.title && next.body === defaults.body) {
    delete engineCopy[id];
  } else {
    engineCopy[id] = next;
  }
  const hasCopy = Object.keys(engineCopy).length > 0;
  return {
    motorEnabled: parsed.motorEnabled,
    toneId: parsed.toneId,
    ...(hasCopy ? { engineCopy } : {}),
  };
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

function parseEngineCopyRecord(
  raw: unknown,
): Partial<Record<ClientLayerEngineId, ClientLayerEngineCopy>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const engineCopy: Partial<Record<ClientLayerEngineId, ClientLayerEngineCopy>> =
    {};
  for (const [key, value] of Object.entries(source)) {
    if (!isClientLayerEngineId(key)) continue;
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!title && !body) continue;
    engineCopy[key] = {
      title: title || defaultEngineCopy(key).title,
      body: body || defaultEngineCopy(key).body,
    };
  }
  return Object.keys(engineCopy).length > 0 ? engineCopy : undefined;
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
  const engineCopy = parseEngineCopyRecord(source.engineCopy);
  return {
    motorEnabled: source.motorEnabled !== false,
    toneId: tone,
    ...(engineCopy ? { engineCopy } : {}),
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

function parsePackStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Persist/read Jaime pack constraints from scenario config JSONB. */
export function parseCatalogClientPackSeed(
  raw: unknown,
): CatalogClientPackSeed | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const decisionRole =
    typeof source.decisionRole === "string" && isDecisionRole(source.decisionRole)
      ? source.decisionRole
      : undefined;
  const howTheyWorkToday =
    typeof source.howTheyWorkToday === "string"
      ? source.howTheyWorkToday.trim()
      : "";
  const onTheirMind =
    typeof source.onTheirMind === "string" ? source.onTheirMind.trim() : "";
  const realObjection =
    typeof source.realObjection === "string" ? source.realObjection.trim() : "";
  const grantConditions =
    typeof source.grantConditions === "string"
      ? source.grantConditions.trim()
      : "";
  const sellerObjective =
    typeof source.sellerObjective === "string"
      ? source.sellerObjective.trim()
      : "";
  if (
    !decisionRole ||
    !howTheyWorkToday ||
    !onTheirMind ||
    !realObjection ||
    !grantConditions ||
    !sellerObjective
  ) {
    return undefined;
  }
  return {
    decisionRole,
    howTheyWorkToday,
    onTheirMind,
    allowedFacts: parsePackStringList(source.allowedFacts),
    forbiddenClaims: parsePackStringList(source.forbiddenClaims),
    realObjection,
    grantConditions,
    sellerObjective,
  };
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
