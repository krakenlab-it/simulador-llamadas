import type { ScenarioLanguage } from "./types";

/** MX contact-center buyer temperaments (trainer pick list). */
export const MX_SALES_TEMPERAMENTS_ES = [
  "Escéptico, poco tiempo",
  "Directo, sin rodeos",
  "Desconfiado del pitch",
  "Ocupado, interrumpe",
  "Analítico, pide datos",
  "Impaciente, quiere colgar",
  "Curioso pero guardado",
  "Molesto por llamadas frías",
  "Prepotente, pone a prueba",
  "Amable pero indeciso",
  "Cortante, corta el monólogo",
  "Negociador duro",
  "Escéptico con presupuesto",
  "Escéptico con proveedor actual",
  "Pragmático, solo resultados",
  "Cauteloso, pide referencias",
] as const;

export const EN_SALES_TEMPERAMENTS = [
  "Skeptical, short on time",
  "Direct, no fluff",
  "Guarded about the pitch",
  "Busy, interrupts",
  "Analytical, wants proof",
  "Impatient, may hang up",
  "Curious but guarded",
  "Annoyed by cold calls",
  "Dominant, tests the rep",
  "Friendly but indecisive",
  "Blunt, cuts monologues",
  "Hard negotiator",
  "Budget-skeptical",
  "Happy with current vendor",
  "Pragmatic, outcomes only",
  "Cautious, wants references",
] as const;

export const TEMPERAMENT_OTHER_VALUE = "__otro__";

export function temperamentOptions(
  language: ScenarioLanguage,
): readonly string[] {
  return language === "en" ? EN_SALES_TEMPERAMENTS : MX_SALES_TEMPERAMENTS_ES;
}

export function defaultTemperamentFromList(language: ScenarioLanguage): string {
  return temperamentOptions(language)[0];
}

export function isListedTemperament(
  value: string,
  language: ScenarioLanguage,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return temperamentOptions(language).some(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
}

export function resolveTemperamentSelectValue(
  value: string,
  language: ScenarioLanguage,
): string {
  if (!value.trim()) return temperamentOptions(language)[0];
  if (isListedTemperament(value, language)) {
    const match = temperamentOptions(language).find(
      (option) => option.toLowerCase() === value.trim().toLowerCase(),
    );
    return match ?? value;
  }
  return TEMPERAMENT_OTHER_VALUE;
}
