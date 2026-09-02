import { getClientBySlug } from "@/lib/clients";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { ROUNDS } from "@/lib/simulation/rounds";
import type { ScenarioConfig, ScenarioRoundDef } from "./types";
import { isClinicPreset } from "./types";

/** Minimal ScenarioConfig for Groq client replies on clinic presets. */
export function buildPresetScenarioConfig(slug: string): ScenarioConfig | null {
  if (!isClinicPreset(slug)) return null;
  const client = getClientBySlug(slug);
  if (!client) return null;

  const rounds: ScenarioRoundDef[] = ROUNDS.map((meta) => ({
    key: meta.key,
    label: meta.label,
    goal: ROUND_EXPECTED[meta.key],
    clientPrompt: meta.label,
    positiveCriteria: [],
    negativeCriteria: [],
  }));

  return {
    industry: client.company,
    productSold: `Solución comercial orientada a ${client.indicator.toLowerCase()}`,
    clientProblem: client.pains.join(". "),
    objections: [...client.openings],
    winCriteria: "Reunión con día y hora concretos",
    temperament: client.difficulty,
    rounds,
    criteria: [],
    globalPositiveCriteria: ["problema", "medicion", "reunion"],
    openingLines: [...client.openings],
    language: "es",
  };
}
