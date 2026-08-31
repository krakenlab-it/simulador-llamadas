import type { ScoringKeyword } from "@/lib/db/types";

export interface KeywordMatcher {
  keyword: ScoringKeyword;
  label: string;
  pattern: RegExp;
}

/**
 * Keyword patterns ported from docs/prototype/Clinica-de-Citas-Simulador-de-Llamada.html
 * plus se_presenta_solo for self-introduction detection.
 */
export const KEYWORD_MATCHERS: readonly KeywordMatcher[] = [
  { keyword: "problema", label: "problema", pattern: /problema/i },
  {
    keyword: "medicion",
    label: "medición",
    pattern: /medici[oó]n|medir|m[eé]trica/i,
  },
  {
    keyword: "jerga",
    label: "jerga",
    pattern: /cpm|ctr|roi|kpi|impresiones|m2|m²|tr[aá]fico/i,
  },
  {
    keyword: "reconocimiento",
    label: "reconoce",
    pattern: /entiendo|comprendo|tiene raz[oó]n|veo que/i,
  },
  {
    keyword: "descalifica",
    label: "descalifica",
    pattern: /no es para usted|no califica/i,
  },
  { keyword: "gratis", label: "gratis", pattern: /gratis|sin costo/i },
  {
    keyword: "reunion",
    label: "reunión",
    pattern: /reuni[oó]n|cita|agendar/i,
  },
  {
    keyword: "dia_hora",
    label: "día/hora",
    pattern: /(lunes|martes|mi[eé]rcoles|jueves|viernes).*\d{1,2}/i,
  },
  { keyword: "monologo", label: "monólogo", pattern: /.{220,}/ },
  { keyword: "telegrama", label: "telegrama", pattern: /^.{0,18}$/ },
  {
    keyword: "se_presenta_solo",
    label: "sePresentaSolo",
    pattern: /^(hola[,.\s]*)?(soy|me llamo|mi nombre es)\b/i,
  },
] as const;

export const DAY_PATTERN =
  /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+de)/i;

export const TIME_PATTERN = /\d{1,2}[:h]\d{2}|\d{1,2}\s*(am|pm|hrs?)/i;
