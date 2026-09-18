import type { RoundType } from "@/lib/db/types";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
import type { ClientReaction } from "./rondas";

/**
 * Client reply lines keyed by scenario slug, round, and reaction tier.
 * Clinic presets read from the PREFILLED catalog so each client stays distinct.
 */
export const SCENARIO_REACTIONS: Record<
  string,
  Partial<Record<RoundType, Record<ClientReaction, string>>>
> = {
  mariana: getCatalogPreset("mariana")?.reactions ?? {},
  rodrigo: getCatalogPreset("rodrigo")?.reactions ?? {},
  efrain: getCatalogPreset("efrain")?.reactions ?? {},
};

const DEFAULT_REACTIONS: Record<RoundType, Record<ClientReaction, string>> = {
  apertura: {
    bien: "Adelante, sea concreto.",
    medio: "¿Quién habla?",
    mal: "No tengo tiempo.",
  },
  objecion: {
    bien: "Siga, eso suena razonable.",
    medio: "Eso ya lo escuché. ¿Qué resultado me trae?",
    mal: "No me convence.",
  },
  claridad: {
    bien: "Entiendo. ¿Cómo lo medirían?",
    medio: "Explíqueme en una frase qué medirían.",
    mal: "No queda claro.",
  },
  correo: {
    bien: "De acuerdo, envíe algo breve.",
    medio: "Mande su correo, pero sea breve.",
    mal: "No quiero más correos.",
  },
  cierre: {
    bien: "Queda agendado.",
    medio: "Si no hay fecha en la agenda, no hay reunión.",
    mal: "Sin día y hora concretos no hay reunión.",
  },
};

export function getClientReply(
  scenarioSlug: string,
  roundType: RoundType,
  reaction: ClientReaction,
): string {
  const scenarioReactions = SCENARIO_REACTIONS[scenarioSlug]?.[roundType];
  return scenarioReactions?.[reaction] ?? DEFAULT_REACTIONS[roundType][reaction];
}
