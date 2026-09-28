import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioLanguage } from "./types";

export const SCENARIO_DIFFICULTY_ETIQUETAS_ES = [
  "Fácil",
  "Intermedio",
  "Difícil",
] as const;

export const SCENARIO_DIFFICULTY_ETIQUETAS_EN = [
  "Easy",
  "Medium",
  "Hard",
] as const;

export type ScenarioDifficultyEtiqueta =
  | (typeof SCENARIO_DIFFICULTY_ETIQUETAS_ES)[number]
  | (typeof SCENARIO_DIFFICULTY_ETIQUETAS_EN)[number];

const ALIASES: Record<string, ScenarioDifficultyEtiqueta> = {
  facil: "Fácil",
  fácil: "Fácil",
  easy: "Easy",
  media: "Intermedio",
  medium: "Medium",
  intermedio: "Intermedio",
  "intermedia-alta": "Difícil",
  alta: "Difícil",
  dificil: "Difícil",
  difícil: "Difícil",
  hard: "Hard",
};

export function difficultyEtiquetaOptions(
  language: ScenarioLanguage,
): readonly string[] {
  return language === "en"
    ? SCENARIO_DIFFICULTY_ETIQUETAS_EN
    : SCENARIO_DIFFICULTY_ETIQUETAS_ES;
}

export function defaultDifficultyEtiqueta(language: ScenarioLanguage): string {
  return language === "en" ? "Medium" : "Intermedio";
}

export function normalizeDifficultyEtiqueta(
  value: string | null | undefined,
  language: ScenarioLanguage,
): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return defaultDifficultyEtiqueta(language);
  const key = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const alias = ALIASES[key] ?? ALIASES[trimmed.toLowerCase()];
  if (alias) {
    if (language === "en") {
      if (alias === "Fácil") return "Easy";
      if (alias === "Intermedio") return "Medium";
      if (alias === "Difícil") return "Hard";
    }
    return alias;
  }
  const options = difficultyEtiquetaOptions(language);
  const match = options.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? defaultDifficultyEtiqueta(language);
}

/** Case etiqueta → practice hub level (Principiante / Intermedio / Avanzado). */
export function difficultyLevelFromEtiqueta(
  etiqueta: string | null | undefined,
  language: ScenarioLanguage = "es",
): DifficultyLevel {
  const normalized = normalizeDifficultyEtiqueta(etiqueta, language);
  if (normalized === "Fácil" || normalized === "Easy") return 1;
  if (normalized === "Difícil" || normalized === "Hard") return 3;
  return 2;
}

/**
 * Unifies trainer hub level with case etiqueta: the harder of the two wins so
 * «Avanzado» + «Fácil» still feels like intermediate+, not a free pass.
 */
export function combinedPracticeDifficulty(
  hubLevel: DifficultyLevel,
  difficultyLabel?: string | null,
  language: ScenarioLanguage | string = "es",
): DifficultyLevel {
  const lang: ScenarioLanguage = language === "en" ? "en" : "es";
  const fromCase = difficultyLevelFromEtiqueta(difficultyLabel, lang);
  return Math.max(hubLevel, fromCase) as DifficultyLevel;
}

export function difficultyEtiquetaInstruction(
  etiqueta: string,
  language: ScenarioLanguage = "es",
): string {
  const level = difficultyLevelFromEtiqueta(etiqueta, language);
  if (level === 1) {
    return language === "en"
      ? "Case difficulty Easy: softer objections, more patience, easier to grant a meeting if the rep is decent."
      : "Dificultad del caso Fácil: objeciones más suaves, más paciencia, más fácil conceder cita si el vendedor va bien.";
  }
  if (level === 3) {
    return language === "en"
      ? "Case difficulty Hard: tough objections, low patience, needs strong proof before any slot."
      : "Dificultad del caso Difícil: objeciones duras, poca paciencia, exige prueba fuerte antes de ceder horario.";
  }
  return language === "en"
    ? "Case difficulty Medium: balanced pushback and patience."
    : "Dificultad del caso Intermedio: empuje y paciencia equilibrados.";
}
