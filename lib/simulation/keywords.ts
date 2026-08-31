import type { ScoringKeyword } from "@/lib/db/types";

const KEYWORD_LABELS: Record<ScoringKeyword, string> = {
  problema: "problema",
  medicion: "medición",
  jerga: "jerga",
  reconocimiento: "reconocimiento",
  descalifica: "descalifica",
  gratis: "gratis",
  reunion: "reunión",
  dia_hora: "día/hora",
  monologo: "monólogo",
  telegrama: "telegrama",
  se_presenta_solo: "se presenta solo",
};

export function getKeywordLabels(): { key: ScoringKeyword; label: string }[] {
  return (Object.entries(KEYWORD_LABELS) as [ScoringKeyword, string][]).map(
    ([key, label]) => ({ key, label }),
  );
}
