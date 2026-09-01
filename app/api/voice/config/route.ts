import { NextResponse } from "next/server";
import {
  isServerSttTier,
  isServerTtsTier,
  resolveSttTier,
  resolveTtsTier,
  resolveVoiceLadder,
} from "@/lib/voice/ladder";
import { isBilledElevenLabsPathAvailable } from "@/lib/voice/gates";
import {
  DAILY_BILLED_SESSIONS_PER_USER,
  GLOBAL_MAX_CONCURRENT_CONVAI,
  GLOBAL_MONTHLY_CONVAI_MINUTES,
  SESSION_CONVAI_MAX_SECONDS,
  SESSION_CONVAI_WARN_REMAINING_SECONDS,
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_MAX_ROUNDS,
} from "@/lib/voice/brakes";

/** Public voice ladder config — no secrets. */
export async function GET() {
  const ladder = resolveVoiceLadder();
  const sttTier = resolveSttTier();
  const ttsTier = resolveTtsTier();

  return NextResponse.json({
    sttTier,
    ttsTier,
    convaiEnabled: ladder.convaiEnabled,
    pronunciationDictionary: ladder.pronunciationDictionary,
    serverStt: isServerSttTier(sttTier),
    serverTts: isServerTtsTier(ttsTier),
    elevenlabsBilledAvailable: isBilledElevenLabsPathAvailable(),
    requiresVoiceAuth:
      isBilledElevenLabsPathAvailable() &&
      (sttTier === "elevenlabs-scribe" || ttsTier === "elevenlabs"),
    brakes: {
      sessionConvaiMaxSeconds: SESSION_CONVAI_MAX_SECONDS,
      sessionConvaiWarnRemainingSeconds: SESSION_CONVAI_WARN_REMAINING_SECONDS,
      sessionMaxRounds: SESSION_MAX_ROUNDS,
      sessionExtraTtsMaxChars: SESSION_EXTRA_TTS_MAX_CHARS,
      dailyBilledSessionsPerUser: DAILY_BILLED_SESSIONS_PER_USER,
      globalMaxConcurrentConvai: GLOBAL_MAX_CONCURRENT_CONVAI,
      globalMonthlyConvaiMinutes: GLOBAL_MONTHLY_CONVAI_MINUTES,
    },
  });
}
