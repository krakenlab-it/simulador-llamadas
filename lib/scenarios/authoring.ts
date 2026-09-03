import { SCORE_DIMENSIONS } from "@/lib/scoring/dimensions";
import { CLINIC_PHASE_COUNT } from "@/lib/simulation/rounds";
import type { ScoreDimensionId } from "@/lib/scoring/types";
import { buildDefaultRounds, buildScenarioConfig } from "./defaults";
import type {
  CreateCustomScenarioInput,
  DimensionGuides,
  ScenarioCallType,
  ScenarioConfig,
  ScenarioLanguage,
  ScenarioRecord,
  ScenarioRoundDef,
  UpdateCustomScenarioInput,
} from "./types";
import {
  isScenarioCallType,
  isScenarioLanguage,
} from "./types";

export const MIN_AUTHORED_BEATS = 3;
export const MAX_AUTHORED_BEATS = 7;

export const AUTHORING_STEPS = ["persona", "beats", "success"] as const;
export type AuthoringStep = (typeof AUTHORING_STEPS)[number];

export interface ScenarioAuthoringDraft {
  industry: string;
  productSold: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  temperament: string;
  difficultyLabel: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
  language: ScenarioLanguage;
  callType: ScenarioCallType;
  rounds: ScenarioRoundDef[];
  dimensionGuides: DimensionGuides;
}

export function defaultScenarioLanguage(): ScenarioLanguage {
  return "es";
}

export function defaultScenarioCallType(): ScenarioCallType {
  return "discovery";
}

export function normalizeAuthoringLanguage(
  value: string | null | undefined,
): ScenarioLanguage {
  if (value && isScenarioLanguage(value)) return value;
  return defaultScenarioLanguage();
}

export function resolveScenarioCallType(
  value: string | null | undefined,
  fallback?: ScenarioCallType,
): ScenarioCallType {
  if (value && isScenarioCallType(value)) return value;
  return fallback ?? defaultScenarioCallType();
}

export function languageLabel(language: ScenarioLanguage): string {
  switch (language) {
    case "es":
      return "Español";
    case "en":
      return "English";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function callTypeLabel(callType: ScenarioCallType): string {
  switch (callType) {
    case "fria":
      return "Llamada fría";
    case "discovery":
      return "Discovery";
    case "cierre":
      return "Cierre";
    default: {
      const _exhaustive: never = callType;
      return _exhaustive;
    }
  }
}

export function defaultDimensionGuides(
  language: ScenarioLanguage,
): Record<ScoreDimensionId, string> {
  switch (language) {
    case "en":
      return {
        apertura_contrato:
          "Introduces yourself, asks permission, and states why you called in about 20 seconds.",
        discovery_escucha:
          "Asks open questions and lets the buyer talk more than the seller.",
        dolor_implicacion:
          "Names the real problem and asks what it costs if nothing changes.",
        valor_tailor:
          "Ties the offer to this buyer's world — not generic CPM/CTR/ROI jargon.",
        compostura_objecion:
          "Validates the doubt without arguing or disqualifying the buyer.",
        cierre_siguiente_paso:
          "Proposes a concrete next step with a day and a time.",
      };
    case "es":
      return {
        apertura_contrato:
          "Se presenta, pide permiso y deja claro por qué llama en unos 20 segundos.",
        discovery_escucha:
          "Hace preguntas abiertas y deja hablar más al cliente que al vendedor.",
        dolor_implicacion:
          "Nombra el problema real y pregunta qué le cuesta si no cambia nada.",
        valor_tailor:
          "Conecta la oferta con el mundo de este cliente, no con jerga genérica (CPM/CTR/ROI).",
        compostura_objecion:
          "Valida la duda sin pelear ni descalificar al cliente.",
        cierre_siguiente_paso:
          "Propone un siguiente paso concreto con día y hora.",
      };
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function defaultWinCriteria(language: ScenarioLanguage): string {
  switch (language) {
    case "en":
      return "SPIN Advance: a concrete next action with day and time (not a vague 'let's meet').";
    case "es":
      return "SPIN Advance: siguiente acción concreta con día y hora (no solo «reunión» genérica).";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function defaultTemperament(language: ScenarioLanguage): string {
  switch (language) {
    case "en":
      return "Skeptical, short on time";
    case "es":
      return "Escéptico, poco tiempo";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function defaultDifficultyLabel(language: ScenarioLanguage): string {
  switch (language) {
    case "en":
      return "Medium";
    case "es":
      return "Media";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

function slugifyBeatKey(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return base || `fase-${index + 1}`;
}

export function normalizeAuthoredRounds(
  rounds: ScenarioRoundDef[] | undefined,
  fallback: {
    industry: string;
    productSold: string;
    clientProblem: string;
    temperament: string;
  },
): ScenarioRoundDef[] {
  const source =
    rounds && rounds.length > 0
      ? rounds
      : buildDefaultRounds(
          fallback.industry,
          fallback.productSold,
          fallback.clientProblem,
          fallback.temperament,
        );

  const used = new Set<string>();
  const normalized = source.slice(0, MAX_AUTHORED_BEATS).map((round, index) => {
    let key = (round.key || slugifyBeatKey(round.label, index)).trim();
    if (!key || used.has(key)) {
      key = `${slugifyBeatKey(round.label || `fase-${index + 1}`, index)}-${index + 1}`;
    }
    used.add(key);
    return {
      key,
      label: round.label.trim() || `Fase ${index + 1}`,
      goal: round.goal.trim(),
      clientPrompt: round.clientPrompt.trim(),
      positiveCriteria: [...(round.positiveCriteria ?? [])],
      negativeCriteria: [...(round.negativeCriteria ?? [])],
      whatGoodLooksLike: round.whatGoodLooksLike?.trim() || undefined,
    };
  });

  if (normalized.length >= MIN_AUTHORED_BEATS) return normalized;

  const padded = [...normalized];
  while (padded.length < MIN_AUTHORED_BEATS) {
    const index = padded.length;
    padded.push({
      key: `fase-${index + 1}`,
      label: `Fase ${index + 1}`,
      goal: "",
      clientPrompt: "",
      positiveCriteria: [],
      negativeCriteria: [],
      whatGoodLooksLike: undefined,
    });
  }
  return padded;
}

export function scoringPhaseCount(
  config: ScenarioConfig | null | undefined,
  isPreset: boolean,
): number {
  if (isPreset || !config?.rounds?.length) return CLINIC_PHASE_COUNT;
  return Math.max(
    MIN_AUTHORED_BEATS,
    Math.min(MAX_AUTHORED_BEATS, config.rounds.length),
  );
}

export function openingLineForCall(
  config: ScenarioConfig | null | undefined,
  isPreset: boolean,
  presetLine?: string,
): string {
  if (isPreset && presetLine) return presetLine;
  const authored =
    config?.openingLines?.[0]?.trim() ||
    config?.rounds?.[0]?.clientPrompt?.trim();
  return authored || "¿Quién habla?";
}

export function phaseLabelsForCall(
  config: ScenarioConfig | null | undefined,
  isPreset: boolean,
): string[] {
  if (isPreset || !config?.rounds?.length) {
    return ["Apertura", "Objeción", "Claridad", "Correo", "Cierre"];
  }
  return normalizeAuthoredRounds(config.rounds, {
    industry: config.industry,
    productSold: config.productSold,
    clientProblem: config.clientProblem,
    temperament: config.temperament,
  }).map((round) => round.label);
}

export function emptyAuthoringDraft(
  language: ScenarioLanguage = defaultScenarioLanguage(),
): ScenarioAuthoringDraft {
  const temperament = defaultTemperament(language);
  return {
    industry: "",
    productSold: "",
    clientName: "",
    clientTitle: "",
    companyContext: "",
    temperament,
    difficultyLabel: defaultDifficultyLabel(language),
    clientProblem: "",
    objections: ["", ""],
    winCriteria: defaultWinCriteria(language),
    language,
    callType: defaultScenarioCallType(),
    rounds: buildDefaultRounds("", "", "", temperament),
    dimensionGuides: defaultDimensionGuides(language),
  };
}

export function draftFromRecord(record: ScenarioRecord): ScenarioAuthoringDraft {
  const language = normalizeAuthoringLanguage(
    record.language ?? record.config.language,
  );
  const callType = resolveScenarioCallType(
    record.config.callType,
    defaultScenarioCallType(),
  );
  const defaults = defaultDimensionGuides(language);

  return {
    industry: record.industry ?? record.config.industry ?? "",
    productSold: record.productSold ?? record.config.productSold ?? "",
    clientName: record.clientName,
    clientTitle: record.clientTitle,
    companyContext: record.companyContext,
    temperament:
      record.temperament ??
      record.config.temperament ??
      defaultTemperament(language),
    difficultyLabel: record.difficultyLabel || defaultDifficultyLabel(language),
    clientProblem:
      record.clientProblem ?? record.config.clientProblem ?? "",
    objections:
      record.objections.length > 0
        ? [...record.objections]
        : record.config.objections.length > 0
          ? [...record.config.objections]
          : ["", ""],
    winCriteria:
      record.winCriteria ??
      record.config.winCriteria ??
      defaultWinCriteria(language),
    language,
    callType,
    rounds: normalizeAuthoredRounds(record.config.rounds, {
      industry: record.industry ?? record.config.industry ?? "",
      productSold: record.productSold ?? record.config.productSold ?? "",
      clientProblem: record.clientProblem ?? record.config.clientProblem ?? "",
      temperament:
        record.temperament ??
        record.config.temperament ??
        defaultTemperament(language),
    }),
    dimensionGuides: {
      ...defaults,
      ...(record.config.dimensionGuides ?? {}),
    },
  };
}

export function applyLanguageDefaults(
  draft: ScenarioAuthoringDraft,
  language: ScenarioLanguage,
): ScenarioAuthoringDraft {
  const previousDefaults = defaultDimensionGuides(draft.language);
  const nextDefaults = defaultDimensionGuides(language);
  const guides: DimensionGuides = { ...nextDefaults };

  for (const dim of SCORE_DIMENSIONS) {
    const current = draft.dimensionGuides[dim.id]?.trim() ?? "";
    const wasDefault = current === previousDefaults[dim.id];
    guides[dim.id] = !current || wasDefault ? nextDefaults[dim.id] : current;
  }

  const nextWin =
    draft.winCriteria.trim() === defaultWinCriteria(draft.language) ||
    !draft.winCriteria.trim()
      ? defaultWinCriteria(language)
      : draft.winCriteria;

  const nextTemperament =
    draft.temperament.trim() === defaultTemperament(draft.language) ||
    !draft.temperament.trim()
      ? defaultTemperament(language)
      : draft.temperament;

  const nextDifficulty =
    draft.difficultyLabel.trim() === defaultDifficultyLabel(draft.language) ||
    !draft.difficultyLabel.trim()
      ? defaultDifficultyLabel(language)
      : draft.difficultyLabel;

  return {
    ...draft,
    language,
    winCriteria: nextWin,
    temperament: nextTemperament,
    difficultyLabel: nextDifficulty,
    dimensionGuides: guides,
  };
}

export function validateAuthoringDraft(
  draft: ScenarioAuthoringDraft,
): string | null {
  const required: Array<[keyof ScenarioAuthoringDraft, string]> = [
    ["industry", "industria"],
    ["productSold", "qué se vende"],
    ["clientName", "nombre del cliente"],
    ["clientTitle", "rol del cliente"],
    ["companyContext", "empresa / contexto"],
    ["clientProblem", "problema del cliente"],
    ["winCriteria", "criterio de éxito"],
  ];

  for (const [field, label] of required) {
    const value = draft[field];
    if (typeof value === "string" && !value.trim()) {
      return `Falta ${label}.`;
    }
  }

  if (!isScenarioLanguage(draft.language)) {
    return "Elige un idioma del cliente.";
  }
  if (!isScenarioCallType(draft.callType)) {
    return "Elige el tipo de llamada.";
  }

  const rounds = normalizeAuthoredRounds(draft.rounds, {
    industry: draft.industry,
    productSold: draft.productSold,
    clientProblem: draft.clientProblem,
    temperament: draft.temperament,
  });

  if (rounds.length < MIN_AUTHORED_BEATS) {
    return `Define al menos ${MIN_AUTHORED_BEATS} fases.`;
  }
  if (rounds.some((round) => !round.label.trim() || !round.goal.trim())) {
    return "Cada fase necesita nombre y qué debe lograr el vendedor.";
  }

  return null;
}

export function draftToCreateInput(
  draft: ScenarioAuthoringDraft,
): CreateCustomScenarioInput {
  const rounds = normalizeAuthoredRounds(draft.rounds, {
    industry: draft.industry,
    productSold: draft.productSold,
    clientProblem: draft.clientProblem,
    temperament: draft.temperament,
  });

  return {
    industry: draft.industry.trim(),
    productSold: draft.productSold.trim(),
    clientName: draft.clientName.trim(),
    clientTitle: draft.clientTitle.trim(),
    companyContext: draft.companyContext.trim(),
    temperament: draft.temperament.trim() || defaultTemperament(draft.language),
    difficultyLabel:
      draft.difficultyLabel.trim() || defaultDifficultyLabel(draft.language),
    clientProblem: draft.clientProblem.trim(),
    objections: draft.objections.map((item) => item.trim()).filter(Boolean),
    winCriteria: draft.winCriteria.trim(),
    language: draft.language,
    callType: draft.callType,
    rounds,
    dimensionGuides: SCORE_DIMENSIONS.reduce<DimensionGuides>((acc, dim) => {
      const text = draft.dimensionGuides[dim.id]?.trim();
      if (text) acc[dim.id] = text;
      return acc;
    }, {}),
  };
}

export function draftToUpdateInput(
  slug: string,
  draft: ScenarioAuthoringDraft,
): UpdateCustomScenarioInput {
  return { ...draftToCreateInput(draft), slug };
}

export function parseAuthoringBody(
  body: Partial<CreateCustomScenarioInput> & { language?: string; callType?: string },
):
  | { ok: true; input: CreateCustomScenarioInput }
  | { ok: false; error: string } {
  const language = normalizeAuthoringLanguage(body.language);
  const callType = resolveScenarioCallType(body.callType);
  const draft: ScenarioAuthoringDraft = {
    industry: body.industry ?? "",
    productSold: body.productSold ?? "",
    clientName: body.clientName ?? "",
    clientTitle: body.clientTitle ?? "",
    companyContext: body.companyContext ?? "",
    temperament: body.temperament ?? defaultTemperament(language),
    difficultyLabel: body.difficultyLabel ?? defaultDifficultyLabel(language),
    clientProblem: body.clientProblem ?? "",
    objections: Array.isArray(body.objections) ? body.objections : ["", ""],
    winCriteria: body.winCriteria ?? "",
    language,
    callType,
    rounds: body.rounds ?? [],
    dimensionGuides: body.dimensionGuides ?? defaultDimensionGuides(language),
  };

  const error = validateAuthoringDraft(draft);
  if (error) return { ok: false, error };
  return { ok: true, input: draftToCreateInput(draft) };
}

export function buildAuthoredScenarioConfig(
  input: CreateCustomScenarioInput,
): ScenarioConfig {
  return buildScenarioConfig({
    industry: input.industry,
    productSold: input.productSold,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    temperament: input.temperament,
    clientName: input.clientName,
    language: normalizeAuthoringLanguage(input.language),
    callType: resolveScenarioCallType(input.callType),
    rounds: input.rounds,
    dimensionGuides: input.dimensionGuides,
  });
}

export function formatDimensionGuidesForPrompt(
  guides: DimensionGuides | undefined,
): string {
  if (!guides) return "";
  return SCORE_DIMENSIONS.map((dim) => {
    const text = guides[dim.id]?.trim();
    if (!text) return null;
    return `- ${dim.id} (${dim.label}): ${text}`;
  })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function nextAuthoringStep(step: AuthoringStep): AuthoringStep {
  switch (step) {
    case "persona":
      return "beats";
    case "beats":
      return "success";
    case "success":
      return "success";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function previousAuthoringStep(step: AuthoringStep): AuthoringStep {
  switch (step) {
    case "persona":
      return "persona";
    case "beats":
      return "persona";
    case "success":
      return "beats";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
