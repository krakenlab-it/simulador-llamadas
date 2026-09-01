import type { RoundType } from "@/lib/db/types";
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

/** Strip a follow-up suffix (e.g. cierre-6 → cierre) for scoring lookups. */
export function phaseKeyFromPersistenceKey(roundKey: string): string {
  const dash = roundKey.lastIndexOf("-");
  if (dash > 0 && /^\d+$/.test(roundKey.slice(dash + 1))) {
    return roundKey.slice(0, dash);
  }
  return roundKey;
}

export function isClinicRoundType(key: string): key is RoundType {
  return (
    key === "apertura" ||
    key === "objecion" ||
    key === "claridad" ||
    key === "correo" ||
    key === "cierre"
  );
}
