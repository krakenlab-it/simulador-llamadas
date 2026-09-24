import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { ROUNDS } from "@/lib/simulation/rounds";
import {
  buildCatalogScenarioConfig,
  getCatalogPreset,
} from "./catalog-presets";
import type { ScenarioConfig, ScenarioRoundDef } from "./types";
import { isClinicPreset } from "./types";

/** Rich ScenarioConfig for clinic presets — catalog is the source of truth. */
export function buildPresetScenarioConfig(slug: string): ScenarioConfig | null {
  if (!isClinicPreset(slug)) return null;
  const preset = getCatalogPreset(slug);
  const base = buildCatalogScenarioConfig(slug);
  if (!preset || !base) return null;

  const rounds: ScenarioRoundDef[] = ROUNDS.map((meta) => ({
    key: meta.key,
    label: meta.label,
    goal: ROUND_EXPECTED[meta.key],
    clientPrompt: preset.reactions[meta.key].medio,
    positiveCriteria: [],
    negativeCriteria: [],
    whatGoodLooksLike: `El vendedor habla el idioma de ${preset.indicator.toLowerCase()} y propone un siguiente paso con día y hora.`,
  }));

  return {
    ...base,
    rounds,
  };
}
