import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";
import {
  checkDailyUserBudget,
  checkGlobalMonthlyBudget,
  reserveBilledSession,
} from "@/lib/voice/usage";
import { isBilledElevenLabsPathAvailable } from "@/lib/voice/gates";
import {
  SESSION_CONVAI_MAX_SECONDS,
  SESSION_CONVAI_WARN_REMAINING_SECONDS,
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_MAX_ROUNDS,
  DAILY_BILLED_SESSIONS_PER_USER,
  GLOBAL_MAX_CONCURRENT_CONVAI,
  GLOBAL_MONTHLY_CONVAI_MINUTES,
} from "@/lib/voice/brakes";

export async function POST(request: Request) {
  try {
    if (!isBilledElevenLabsPathAvailable()) {
      return NextResponse.json({
        fallbackToBrowser: true,
        reason: "elevenlabs_disabled",
      });
    }

    const auth = await resolveVoiceAuth(request);
    if (!isVoiceAuthContext(auth)) return auth;

    const body = (await request.json()) as { callAttemptId?: string };

    const result = await withPgClient(async (client) => {
      const daily = await checkDailyUserBudget(client, auth.verifiedUserId);
      if (!daily.allowed) return daily;

      const monthly = await checkGlobalMonthlyBudget(client);
      if (!monthly.allowed) return monthly;

      return reserveBilledSession(
        client,
        auth.verifiedUserId,
        body.callAttemptId,
      );
    });

    if ("fallbackToBrowser" in result && result.fallbackToBrowser) {
      return NextResponse.json(result);
    }

    if ("sessionUsageId" in result) {
      return NextResponse.json({
        sessionUsageId: result.sessionUsageId,
        verifiedUserId: auth.verifiedUserId,
        limits: {
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

    return NextResponse.json({ error: "Unexpected result" }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
