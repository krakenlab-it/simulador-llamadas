import type { DifficultyLevel } from "@/lib/db/types";
import { DIFFICULTY_LABELS } from "@/lib/frontend/training-readiness";
import { normalizeDifficultyEtiqueta } from "@/lib/scenarios/difficulty-etiquette";

export function difficultyCoachHint(
  etiqueta: string,
  language: "es" | "en" = "es",
): string {
  const normalized = normalizeDifficultyEtiqueta(etiqueta, language);
  if (normalized === "Fácil" || normalized === "Easy") {
    return "Comprador más abierto: objeciones suaves y más paciencia para conceder cita.";
  }
  if (normalized === "Difícil" || normalized === "Hard") {
    return "Comprador exigente: objeciones duras; hay que ganarse el siguiente paso.";
  }
  return "Equilibrio: empuja sin colgar al primer intento.";
}

export function hubDifficultyHint(level: DifficultyLevel): string {
  switch (level) {
    case 1:
      return `${DIFFICULTY_LABELS[1]}: más margen en la práctica (cierre un poco más fácil).`;
    case 3:
      return `${DIFFICULTY_LABELS[3]}: el comprador exige día, hora y prueba sólida.`;
    default:
      return `${DIFFICULTY_LABELS[2]}: ritmo real de piso de ventas.`;
  }
}

export const AUTHORING_MENTAL_MODEL = {
  title: "Perfil de entrenamiento, no guion de teatro",
  body:
    "Lo que escribes aquí es briefing para el coach y para la IA. En la llamada en vivo el comprador contesta como persona real — nunca lee estos párrafos en voz alta.",
} as const;

export const PRACTICE_CALL_BANNER =
  "Voz del cliente arriba. El coaching y la consola técnica van aparte — no mezcles briefing con lo que «dice» el comprador.";
