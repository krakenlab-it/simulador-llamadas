import type { Client } from "pg";
import { isElevenLabsEnabled } from "@/lib/voice/brakes";
import { isElevenLabsTier } from "@/lib/voice/ladder";
import type { SttTier, TtsTier } from "@/lib/voice/types";
import {
  checkSessionConvaiBudget,
  checkSessionExtraTtsBudget,
  checkSessionTraineeAudioBudget,
  getSessionUsage,
  type BrakeCheckResult,
  type VoiceSessionUsageRow,
} from "@/lib/voice/usage";

export interface VoiceGateContext {
  sessionUsageId?: string;
  verifiedUserId?: string;
}

export function isBilledElevenLabsPathAvailable(): boolean {
  return isElevenLabsEnabled();
}

/** Gate ElevenLabs API call; returns fallback hint when blocked. */
export async function gateElevenLabsCall(
  client: Client,
  tier: SttTier | TtsTier,
  context: VoiceGateContext,
  options?: { audioSeconds?: number; ttsChars?: number },
): Promise<BrakeCheckResult> {
  if (!isElevenLabsTier(tier)) {
    return { allowed: true, fallbackToBrowser: false };
  }

  if (!isBilledElevenLabsPathAvailable()) {
    return {
      allowed: false,
      reason: "elevenlabs_disabled",
      fallbackToBrowser: true,
    };
  }

  if (!context.sessionUsageId) {
    return {
      allowed: false,
      reason: "voice_auth_required",
      fallbackToBrowser: true,
    };
  }

  const usage = await getSessionUsage(client, context.sessionUsageId);
  if (!usage) {
    return {
      allowed: false,
      reason: "session_not_found",
      fallbackToBrowser: true,
    };
  }

  if (tier === "elevenlabs-scribe" && options?.audioSeconds) {
    const audioCheck = await checkSessionTraineeAudioBudget(
      usage,
      options.audioSeconds,
    );
    if (!audioCheck.allowed) return audioCheck;
  }

  if (tier === "elevenlabs" && options?.ttsChars) {
    const ttsCheck = await checkSessionExtraTtsBudget(usage, options.ttsChars);
    if (!ttsCheck.allowed) return ttsCheck;
  }

  if (tier === "elevenlabs" || tier === "elevenlabs-scribe") {
    const convaiCheck = await checkSessionConvaiBudget(usage);
    if (!convaiCheck.allowed) return convaiCheck;
  }

  return { allowed: true, fallbackToBrowser: false };
}

export function getSessionWarning(
  usage: VoiceSessionUsageRow,
): { warn: boolean; remainingSeconds: number } {
  const remaining = Math.max(0, 180 - usage.convaiSecondsUsed);
  return {
    warn: remaining > 0 && remaining <= 30,
    remainingSeconds: remaining,
  };
}
