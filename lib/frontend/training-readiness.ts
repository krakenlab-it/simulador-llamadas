import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";

export interface TrainingReadinessInput {
  scenarioSelected: boolean;
  mode: PracticeMode;
  speechSupported: boolean;
  micVerified: boolean;
  isStarting: boolean;
  needsVoiceAuth?: boolean;
  voiceAuthVerified?: boolean;
}

export interface BilledVoiceAuthGateInput {
  mode: PracticeMode;
  requiresVoiceAuth: boolean;
  skipped: boolean;
  verifiedUserId?: string | null;
  hasValidSession: boolean;
}

/** Show the login card only when billed voice is on and nobody is signed in. */
export function needsBilledVoiceAuthGate(
  input: BilledVoiceAuthGateInput,
): boolean {
  if (input.mode !== "voz" || !input.requiresVoiceAuth || input.skipped) {
    return false;
  }
  if (input.verifiedUserId || input.hasValidSession) {
    return false;
  }
  return true;
}

export function canStartTraining(input: TrainingReadinessInput): boolean {
  if (input.isStarting || !input.scenarioSelected) return false;
  if (input.mode === "texto") return true;
  const voiceAuthOk =
    !input.needsVoiceAuth || Boolean(input.voiceAuthVerified);
  return input.speechSupported && input.micVerified && voiceAuthOk;
}

export function startBlockedReason(
  input: TrainingReadinessInput,
): string | null {
  if (input.isStarting) return "Conectando la llamada…";
  if (!input.scenarioSelected) return "Elige un escenario para empezar.";
  if (input.mode === "voz" && !input.speechSupported) {
    return "Tu navegador no soporta voz. Usa modo texto o Chrome/Edge.";
  }
  if (input.mode === "voz" && input.needsVoiceAuth && !input.voiceAuthVerified) {
    return "Inicia sesión para usar voz con facturación.";
  }
  if (input.mode === "voz" && !input.micVerified) {
    return "Verifica tu micrófono antes de iniciar.";
  }
  return null;
}

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: "Principiante",
  2: "Intermedio",
  3: "Avanzado",
};

export const MODE_LABELS: Record<PracticeMode, string> = {
  voz: "Voz",
  texto: "Texto",
};
