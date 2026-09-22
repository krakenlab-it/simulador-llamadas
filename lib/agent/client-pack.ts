import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { getCatalogPreset, type CatalogPreset } from "@/lib/scenarios/catalog-presets";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import type { ScenarioConfig } from "@/lib/scenarios/types";
import {
  channelFromMode,
  encounterFromCallType,
  mapDifficultyToJaime,
  parseCatalogClientPackSeed,
  type CatalogClientPackSeed,
  type ClientLayerSettings,
  type ClientScenarioPack,
  type DecisionRole,
} from "./client-layer";

const DEFAULT_FORBIDDEN = [
  "garantía de resultados",
  "100% de éxito",
  "cifras de ventas inventadas",
  "nombres de competidores",
];

export function buildClientPack(input: {
  clientName: string;
  clientTitle?: string;
  company?: string;
  config: ScenarioConfig;
  seed?: CatalogClientPackSeed;
  difficultyLevel: DifficultyLevel;
  mode?: PracticeMode | null;
  maxTurns?: number;
}): ClientScenarioPack {
  const seed = input.seed;
  return {
    channel: channelFromMode(input.mode),
    encounterType: encounterFromCallType(input.config.callType),
    sellerObjective: seed?.sellerObjective ?? input.config.winCriteria,
    difficultyJaime: mapDifficultyToJaime(input.difficultyLevel),
    maxTurns: input.maxTurns ?? Math.max(input.config.rounds.length, 5),
    country: "México",
    register: "español mexicano oral, trato de usted",
    clientName: input.clientName,
    clientTitle: input.clientTitle ?? "",
    decisionRole: seed?.decisionRole ?? "decisor",
    company: input.company ?? input.config.industry,
    industry: input.config.industry,
    temperament: input.config.temperament,
    howTheyWorkToday: seed?.howTheyWorkToday ?? input.config.clientProblem,
    unspokenPains: seed ? [input.config.clientProblem] : input.config.objections.slice(0, 2),
    onTheirMind: seed?.onTheirMind ?? input.config.clientProblem,
    productSold: input.config.productSold,
    allowedFacts: seed?.allowedFacts?.length
      ? seed.allowedFacts
      : [input.config.clientProblem, input.config.productSold].filter(Boolean),
    forbiddenClaims: seed?.forbiddenClaims?.length
      ? seed.forbiddenClaims
      : DEFAULT_FORBIDDEN,
    surfaceObjections: input.config.objections,
    realObjection: seed?.realObjection ?? input.config.objections.at(-1) ?? "",
    grantConditions: seed?.grantConditions ?? input.config.winCriteria,
    winCriteria: input.config.winCriteria,
  };
}

export function buildClientPackFromSlug(
  slug: string,
  difficultyLevel: DifficultyLevel,
  mode?: PracticeMode | null,
): ClientScenarioPack | null {
  const preset = getCatalogPreset(slug);
  if (!preset) return null;
  const config = buildPresetScenarioConfig(slug);
  if (!config) return null;
  return buildClientPack({
    clientName: preset.name,
    clientTitle: preset.title,
    company: preset.company,
    config,
    seed: preset.clientPack,
    difficultyLevel,
    mode,
  });
}

export function formatClientPack(pack: ClientScenarioPack): string {
  return [
    "PACK DEL ESCENARIO",
    `Canal: ${pack.channel}`,
    `Tipo de encuentro: ${pack.encounterType}`,
    `Objetivo del vendedor: ${pack.sellerObjective}`,
    `Nivel (Jaime 1-5): ${pack.difficultyJaime}`,
    `Máximo de turnos: ${pack.maxTurns}`,
    `País / registro: ${pack.country} · ${pack.register}`,
    `Cliente: ${pack.clientName}, ${pack.clientTitle} (${pack.decisionRole})`,
    `Empresa: ${pack.company}`,
    `Industria: ${pack.industry}`,
    `Temperamento: ${pack.temperament}`,
    `Cómo trabaja hoy: ${pack.howTheyWorkToday}`,
    `En la cabeza hoy: ${pack.onTheirMind}`,
    `Dolores: ${pack.unspokenPains.join("; ")}`,
    `Le venden: ${pack.productSold}`,
    `Hechos permitidos: ${pack.allowedFacts.join("; ")}`,
    `Prohibido afirmar: ${pack.forbiddenClaims.join("; ")}`,
    `Objeciones de superficie: ${pack.surfaceObjections.map((item) => `"${item}"`).join("; ")}`,
    `Objeción real: ${pack.realObjection}`,
    `Condiciones para conceder: ${pack.grantConditions}`,
    `Criterio de éxito: ${pack.winCriteria}`,
  ].join("\n");
}

export function packDecisionRole(preset: CatalogPreset): DecisionRole {
  return preset.clientPack.decisionRole;
}

export function buyerPsychPackForScenario(input: {
  scenarioSlug?: string;
  config?: ScenarioConfig | null;
  clientName?: string;
  difficultyLevel?: DifficultyLevel;
  mode?: PracticeMode | null;
}): Pick<ClientScenarioPack, "decisionRole" | "encounterType" | "temperament"> | undefined {
  const difficulty = input.difficultyLevel ?? 1;
  const mode = input.mode ?? "voz";
  const fromSlug =
    input.scenarioSlug &&
    buildClientPackFromSlug(input.scenarioSlug, difficulty, mode);
  if (fromSlug) {
    return {
      decisionRole: fromSlug.decisionRole,
      encounterType: fromSlug.encounterType,
      temperament: fromSlug.temperament,
    };
  }
  if (!input.config || !input.clientName) return undefined;
  const preset = input.scenarioSlug ? getCatalogPreset(input.scenarioSlug) : undefined;
  const pack = buildClientPack({
    clientName: input.clientName,
    clientTitle: preset?.title,
    company: preset?.company,
    config: input.config,
    seed: preset?.clientPack ?? parseCatalogClientPackSeed(input.config.clientPack),
    difficultyLevel: difficulty,
    mode,
    maxTurns: input.config.rounds.length || 5,
  });
  return {
    decisionRole: pack.decisionRole,
    encounterType: pack.encounterType,
    temperament: pack.temperament,
  };
}

export function describeClientLayerForTrainer(
  settings: ClientLayerSettings,
): string {
  const tone =
    settings.toneId === "auto" ? "el tono del personaje" : settings.toneId;
  return settings.motorEnabled
    ? `Cliente en vivo · ${tone}. El pack sale del caso; el coach va aparte.`
    : "Motor apagado: se usan las réplicas fijas del caso.";
}
