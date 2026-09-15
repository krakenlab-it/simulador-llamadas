import type { DifficultyLevel } from "@/lib/db/types";
import type { CallAnalytics } from "@/lib/scoring/types";
import type { EmotionalMeters } from "./types";
import { mapDifficultyToJaime } from "./jaime-prompt";

function clamp(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function initialEmotionalMeters(difficultyLevel: DifficultyLevel): EmotionalMeters {
  const level = mapDifficultyToJaime(difficultyLevel);
  switch (level) {
    case 1:
      return { confianza: 4, interes: 5, paciencia: 8 };
    case 2:
      return { confianza: 3, interes: 4, paciencia: 7 };
    case 3:
      return { confianza: 3, interes: 3, paciencia: 6 };
    case 4:
      return { confianza: 2, interes: 2, paciencia: 5 };
    case 5:
    default:
      return { confianza: 1, interes: 2, paciencia: 4 };
  }
}

export interface MeterUpdateInput {
  utterance: string;
  analytics: CallAnalytics;
  temperament: string;
  turnNumber: number;
  priorTurnNumber: number;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function applyBusyTemperamentDrain(
  meters: EmotionalMeters,
  temperament: string,
  turnNumber: number,
): EmotionalMeters {
  const busy = /ocupad|impacient|directo|sin tiempo|prisa/i.test(temperament);
  if (!busy || turnNumber <= 0 || turnNumber % 3 !== 0) return meters;
  return { ...meters, paciencia: clamp(meters.paciencia - 1) };
}

export function updateEmotionalMeters(
  current: EmotionalMeters,
  input: MeterUpdateInput,
): EmotionalMeters {
  let { confianza, interes, paciencia } = current;
  const utterance = input.utterance.trim();
  const words = wordCount(utterance);
  const lower = utterance.toLowerCase();

  if (words >= 12 && /soy |me llamo|llamo de|le llamo/i.test(utterance)) {
    confianza += 1;
  }
  if (/permiso|interrumpo|un minuto|dos minutos|tiene tiempo/i.test(lower)) {
    paciencia += 1;
  }
  if (input.analytics.questionTypes.open >= 1) {
    interes += 1;
  }
  if (input.analytics.questionTypes.clarifying >= 1) {
    confianza += 1;
  }
  if (/entiendo|o sea|entonces usted|lo que me dice/i.test(lower)) {
    confianza += 1.5;
  }
  if (input.analytics.hasNextStep) {
    confianza += 1;
  }
  if (words > 60 && input.analytics.questionTypes.open + input.analytics.questionTypes.clarifying === 0) {
    paciencia -= 2;
  }
  if (/líder|líderes|soluciones integrales|somos la mejor/i.test(lower)) {
    interes -= 1;
  }
  if (/última oportunidad|solo hoy|corre|ahorita o nunca/i.test(lower)) {
    confianza -= 2;
  }
  if (/agenda|reunión|cita/i.test(lower) && input.analytics.questionTypes.open === 0 && words < 40) {
    confianza -= 1.5;
  }
  if (input.analytics.talkPercent > 85) {
    paciencia -= 1;
  }

  const next: EmotionalMeters = {
    confianza: clamp(confianza),
    interes: clamp(interes),
    paciencia: clamp(paciencia),
  };

  return applyBusyTemperamentDrain(next, input.temperament, input.turnNumber);
}

export function shouldHangUpForPatience(meters: EmotionalMeters): boolean {
  return meters.paciencia <= 0;
}
