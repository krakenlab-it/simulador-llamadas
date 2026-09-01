/**
 * Clinic-term pronunciation hints for Mexican Spanish TTS.
 * Applied as text normalization before synthesis (no hardcoded voice IDs).
 */
const CLINIC_PRONUNCIATIONS: ReadonlyArray<readonly [string, RegExp]> = [
  ["caseta", /\bcasetas?\b/gi],
  ["metro cuadrado", /\bm\s*²\b/gi],
  ["metro cuadrado", /\bm2\b/gi],
  ["showroom", /\bshowrooms?\b/gi],
  ["KPI", /\bKPIs?\b/gi],
  ["ROI", /\bROI\b/gi],
  ["caseta de ventas", /\bcaseta de ventas\b/gi],
];

/** Normalize clinic jargon so TTS engines pronounce terms clearly. */
export function applyPronunciationHints(text: string): string {
  let result = text;
  for (const [spoken, pattern] of CLINIC_PRONUNCIATIONS) {
    result = result.replace(pattern, spoken);
  }
  return result;
}

export function getPronunciationTerms(): string[] {
  return CLINIC_PRONUNCIATIONS.map(([spoken]) => spoken);
}
