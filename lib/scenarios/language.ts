/**
 * Scenario spoken language. Clinic presets are Spanish; custom scenarios
 * default to Spanish unless they declare another ISO 639-1 code.
 */

export const DEFAULT_SCENARIO_LANGUAGE = "es";
export const DEFAULT_SCENARIO_LOCALE = "es-MX";
export const DEFAULT_SCENARIO_LANGUAGE_NAME = "español mexicano";

export interface ScenarioLanguageSource {
  language?: string | null;
}

export interface ScenarioSpeechLanguage {
  /** ISO 639-1 for ElevenLabs language_code. */
  iso639: string;
  /** BCP-47 for speechSynthesis / STT. */
  locale: string;
  /** Human name used in LLM prompts. */
  promptName: string;
}

const KNOWN_LANGUAGES: Record<string, ScenarioSpeechLanguage> = {
  es: {
    iso639: "es",
    locale: "es-MX",
    promptName: DEFAULT_SCENARIO_LANGUAGE_NAME,
  },
  en: { iso639: "en", locale: "en-US", promptName: "English" },
  pt: { iso639: "pt", locale: "pt-BR", promptName: "português brasileiro" },
};

function normalizeLanguageTag(raw?: string | null): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return DEFAULT_SCENARIO_LANGUAGE;
  if (value === "spanish" || value === "español" || value === "espanol") {
    return "es";
  }
  if (value === "english") return "en";
  if (value === "portuguese" || value === "portugués" || value === "portugues") {
    return "pt";
  }
  const iso = value.split(/[-_]/)[0] ?? DEFAULT_SCENARIO_LANGUAGE;
  return iso || DEFAULT_SCENARIO_LANGUAGE;
}

export function resolveScenarioLanguage(
  source?: ScenarioLanguageSource | null,
): ScenarioSpeechLanguage {
  const iso = normalizeLanguageTag(source?.language);
  const known = KNOWN_LANGUAGES[iso];
  if (known) return known;
  return { iso639: iso, locale: iso, promptName: iso };
}

export function resolveTtsLanguageCode(
  source?: ScenarioLanguageSource | null,
): string {
  return resolveScenarioLanguage(source).iso639;
}

export function resolveSpeechLocale(
  source?: ScenarioLanguageSource | null,
): string {
  return resolveScenarioLanguage(source).locale;
}

export function buildLanguageLockSystemPrompt(
  language: ScenarioSpeechLanguage,
): string {
  if (language.iso639 === "es") {
    return [
      "Habla únicamente en español mexicano.",
      "Nunca cambies de idioma, ni en el cierre ni en turnos extra.",
      "No copies el idioma del vendedor si habla otro idioma.",
    ].join(" ");
  }
  return [
    `Speak only ${language.promptName} (${language.iso639}).`,
    "Never switch languages, including the close and any extra turns.",
    `Do not copy the seller's language if it is not ${language.promptName}.`,
  ].join(" ");
}
