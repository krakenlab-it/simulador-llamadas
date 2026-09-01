import type { ScenarioConfig } from "@/lib/scenarios/types";
import type { CallTypeOverlay } from "./types";

export const DEFAULT_WIN_CRITERIA =
  "SPIN Advance: siguiente acción concreta acordada o propuesta (no solo «reunión» genérica)";

export function resolveWinCriteria(config: ScenarioConfig | null): string {
  const custom = config?.winCriteria?.trim();
  if (custom && custom.length > 0) return custom;
  return DEFAULT_WIN_CRITERIA;
}

export function inferCallType(
  config: ScenarioConfig | null,
  isPreset: boolean,
): CallTypeOverlay {
  if (!config) {
    return isPreset ? "fria" : "discovery";
  }

  const win = config.winCriteria.toLowerCase();
  if (win.includes("fría") || win.includes("fria") || win.includes("cold")) {
    return "fria";
  }
  if (win.includes("cierre") || win.includes("close")) {
    return "cierre";
  }
  if (config.industry.toLowerCase().includes("gimnasio")) {
    return "discovery";
  }
  return "discovery";
}

const ADVANCE_PATTERNS = [
  /\b(envío|enviaré|le mando|le llamo|agendamos|agendemos|quedamos|demo|propuesta)\b.{0,80}\b(martes|miércoles|jueves|viernes|lunes|mañana|\d{1,2}|a las)\b/i,
  /\b(siguiente paso|próximo paso)\b.{0,60}\b(concreto|específico|el \w+ a las|\d{1,2})\b/i,
  /\b(le parece si|podemos)\b.{0,80}\b(el \w+|\d{1,2}|mañana)\b/i,
];

export function evaluateAdvanceOutcome(
  traineeText: string,
  winCriteria: string,
): boolean {
  const text = traineeText.toLowerCase();

  if (winCriteria.toLowerCase().includes("spin advance")) {
    return ADVANCE_PATTERNS.some((pattern) => pattern.test(traineeText));
  }

  if (winCriteria.length > 0) {
    const tokens = winCriteria
      .toLowerCase()
      .split(/[^a-záéíóúñ0-9]+/i)
      .filter((t) => t.length > 4)
      .slice(0, 6);
    const hits = tokens.filter((token) => text.includes(token)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }

  return ADVANCE_PATTERNS.some((pattern) => pattern.test(traineeText));
}
