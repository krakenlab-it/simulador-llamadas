import type { ScoringKeyword } from "@/lib/db/types";
import { SCORING_KEYWORDS } from "@/lib/db/types";

/**
 * Scoring extension point — keyword analysis from prototype.
 * Full implementation deferred to backend scoring PR.
 */

export interface ScoringInput {
  utterance: string;
  roundType: string;
}

export interface ScoringResult {
  keywordHits: Partial<Record<ScoringKeyword, boolean>>;
  roundScore: number;
  feedback: string;
  hasConcreteDayAndTime: boolean;
}

const DAY_TIME_PATTERNS = [
  /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i,
  /\b\d{1,2}\s*(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i,
  /\b\d{1,2}[:h]\d{2}\b/i,
  /\b\d{1,2}\s*(am|pm|hrs?)\b/i,
];

export function detectConcreteDayAndTime(utterance: string): boolean {
  const hasDay = DAY_TIME_PATTERNS.slice(0, 2).some((re) => re.test(utterance));
  const hasTime = DAY_TIME_PATTERNS.slice(2).some((re) => re.test(utterance));
  return hasDay && hasTime;
}

export function scoreUtterancePlaceholder(input: ScoringInput): ScoringResult {
  const normalized = input.utterance.toLowerCase();
  const keywordHits: Partial<Record<ScoringKeyword, boolean>> = {};

  const keywordMatchers: Record<ScoringKeyword, RegExp> = {
    problema: /problema/,
    medicion: /medici[oó]n|medir|m[eé]trica/,
    jerga: /cpm|ctr|roi|kpi|impresiones/,
    reconocimiento: /entiendo|comprendo|tiene raz[oó]n/,
    descalifica: /no es para usted|no califica/,
    gratis: /gratis|sin costo|sin compromiso/,
    reunion: /reuni[oó]n|cita|agendar/,
    dia_hora: /(lunes|martes|mi[eé]rcoles|jueves|viernes).*\d{1,2}/,
    monologo: /.{200,}/,
    telegrama: /^.{0,20}$/,
  };

  for (const keyword of SCORING_KEYWORDS) {
    keywordHits[keyword] = keywordMatchers[keyword].test(normalized);
  }

  const hitCount = Object.values(keywordHits).filter(Boolean).length;
  const roundScore = Math.min(100, hitCount * 12);
  const hasConcreteDayAndTime = detectConcreteDayAndTime(input.utterance);

  return {
    keywordHits,
    roundScore,
    feedback: "Puntuación provisional — implementar reglas completas en PR de scoring.",
    hasConcreteDayAndTime,
  };
}
