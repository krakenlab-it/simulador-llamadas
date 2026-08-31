import type { ScoringKeyword } from "@/lib/db/types";
import { SCORING_KEYWORDS } from "@/lib/db/types";
import { DAY_PATTERN, KEYWORD_MATCHERS, TIME_PATTERN } from "./keywords";

export interface AnalisisResult {
  hits: Record<ScoringKeyword, boolean>;
  hasDay: boolean;
  hasTime: boolean;
}

/**
 * Keyword analysis from the HTML prototype `scoreUtterance` hits map.
 */
export function analizar(utterance: string): AnalisisResult {
  const hits = {} as Record<ScoringKeyword, boolean>;

  for (const keyword of SCORING_KEYWORDS) {
    hits[keyword] = false;
  }

  for (const matcher of KEYWORD_MATCHERS) {
    hits[matcher.keyword] = matcher.pattern.test(utterance);
  }

  return {
    hits,
    hasDay: DAY_PATTERN.test(utterance),
    hasTime: TIME_PATTERN.test(utterance),
  };
}
