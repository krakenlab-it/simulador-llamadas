import { CLINIC_PHASE_COUNT } from "@/lib/simulation/rounds";

/**
 * Unique round_key for persistence. Follow-up turns that stay in the same
 * scoring phase (e.g. cierre) need distinct keys because of
 * idx_call_turns_attempt_round_key on (call_attempt_id, round_key).
 */
export function resolveRoundKey(
  phaseKey: string,
  roundNumber: number,
  phaseCount: number = CLINIC_PHASE_COUNT,
): string {
  if (roundNumber > phaseCount) {
    return `${phaseKey}-${roundNumber}`;
  }
  return phaseKey;
}
