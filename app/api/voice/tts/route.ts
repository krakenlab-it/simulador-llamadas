import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  isServerTtsTier,
  resolveTtsTier,
  isElevenLabsTier,
} from "@/lib/voice/ladder";
import { describeTtsFailures, synthesizeSpeech } from "@/lib/voice/tts";
import {
  isSpeakableTtsText,
  sessionExtraTtsRemainingChars,
  truncateForBilledTts,
} from "@/lib/voice/tts-budget";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { getSessionUsage, recordExtraTtsChars } from "@/lib/voice/usage";
import {
  assertSessionOwnership,
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";

function logTtsSpend(payload: {
  charsRequested: number;
  charsSent: number;
  sessionExtraTtsRemaining: number | null;
  fallbackToBrowser: boolean;
  reason?: string;
}): void {
  console.info("voice.tts.spend", payload);
}

export async function POST(request: Request) {
  const tier = resolveTtsTier();
  if (!isServerTtsTier(tier)) {
    return NextResponse.json(
      { error: "Server TTS not configured; use browser fallback.", fallbackToBrowser: true },
      { status: 503 },
    );
  }

  const auth = isElevenLabsTier(tier) ? await resolveVoiceAuth(request) : null;
  if (auth && !isVoiceAuthContext(auth)) return auth;

  const body = (await request.json()) as {
    text?: string;
    sessionUsageId?: string;
  };
  const rawText = body.text?.trim() ?? "";
  const sessionUsageId =
    body.sessionUsageId ?? request.headers.get("x-voice-session-id") ?? undefined;

  if (!rawText) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  if (!isSpeakableTtsText(rawText)) {
    logTtsSpend({
      charsRequested: rawText.length,
      charsSent: 0,
      sessionExtraTtsRemaining: null,
      fallbackToBrowser: true,
      reason: "not_speakable",
    });
    return NextResponse.json(
      { error: "not_speakable", fallbackToBrowser: true },
      { status: 400 },
    );
  }

  const { requestedChars, spokenText, sentChars } = truncateForBilledTts(rawText);

  if (isElevenLabsTier(tier)) {
    if (!auth || !isVoiceAuthContext(auth)) {
      return NextResponse.json(
        { error: "voice_auth_required", fallbackToBrowser: true },
        { status: 401 },
      );
    }
    if (!sessionUsageId) {
      return NextResponse.json(
        { error: "sessionUsageId required", fallbackToBrowser: true },
        { status: 400 },
      );
    }

    const gate = await withPgClient(async (client) => {
      const owned = await assertSessionOwnership(
        client,
        sessionUsageId,
        auth.verifiedUserId,
      );
      if (!owned) {
        return {
          allowed: false,
          reason: "session_forbidden",
          fallbackToBrowser: true,
          sessionExtraTtsRemaining: null as number | null,
        };
      }

      const usage = await getSessionUsage(client, sessionUsageId);
      const sessionExtraTtsRemaining = usage
        ? sessionExtraTtsRemainingChars(usage)
        : 0;

      const brake = await gateElevenLabsCall(
        client,
        tier,
        {
          sessionUsageId,
          verifiedUserId: auth.verifiedUserId,
        },
        { ttsChars: sentChars },
      );

      return { ...brake, sessionExtraTtsRemaining };
    });

    if (!gate.allowed) {
      logTtsSpend({
        charsRequested: requestedChars,
        charsSent: 0,
        sessionExtraTtsRemaining: gate.sessionExtraTtsRemaining,
        fallbackToBrowser: true,
        reason: gate.reason,
      });
      return NextResponse.json(
        { error: gate.reason, fallbackToBrowser: true },
        { status: 429 },
      );
    }
  }

  const synthesis = await synthesizeSpeech(spokenText);

  let sessionExtraTtsRemaining: number | null = null;
  if (isElevenLabsTier(tier) && sessionUsageId) {
    sessionExtraTtsRemaining = await withPgClient(async (client) => {
      const usage = await getSessionUsage(client, sessionUsageId);
      return usage ? sessionExtraTtsRemainingChars(usage) : 0;
    });
  }

  // The browser discards the 502 body, so this log is the only place the
  // ElevenLabs reason survives. Details are secret-scrubbed upstream.
  if (synthesis.failures.length > 0) {
    console.error("voice.tts.elevenlabs_failed", {
      recovered: Boolean(synthesis.result),
      textLength: sentChars,
      attempts: describeTtsFailures(synthesis.failures),
    });
  }

  if (!synthesis.result) {
    logTtsSpend({
      charsRequested: requestedChars,
      charsSent: 0,
      sessionExtraTtsRemaining,
      fallbackToBrowser: true,
      reason: "synthesis_failed",
    });
    return NextResponse.json(
      {
        error: "Synthesis failed.",
        fallbackToBrowser: true,
        attempts: synthesis.failures,
      },
      { status: 502 },
    );
  }

  const result = synthesis.result;

  if (
    isElevenLabsTier(result.tier) &&
    sessionUsageId &&
    auth &&
    isVoiceAuthContext(auth)
  ) {
    sessionExtraTtsRemaining = await withPgClient(async (client) => {
      await recordExtraTtsChars(client, sessionUsageId, sentChars);
      const usage = await getSessionUsage(client, sessionUsageId);
      return usage ? sessionExtraTtsRemainingChars(usage) : 0;
    });
  }

  logTtsSpend({
    charsRequested: requestedChars,
    charsSent: sentChars,
    sessionExtraTtsRemaining,
    fallbackToBrowser: false,
  });

  return new NextResponse(new Uint8Array(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "X-Voice-Tier": result.tier,
      ...(result.endpoint ? { "X-Voice-Endpoint": result.endpoint } : {}),
    },
  });
}
