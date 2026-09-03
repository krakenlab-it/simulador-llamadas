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
  createTtsRequestId,
  logTtsAttempt,
  parseElevenLabsErrorCode,
  type TtsTraceContext,
} from "@/lib/voice/tts-trace";
import { encodePublicTtsTraceHeader } from "@/lib/voice/console-log";
import {
  assertSessionOwnership,
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";
import {
  clampSpeakingRate,
  parseVoiceAgentSettings,
  resolvePremadeVoiceId,
} from "@/lib/voice/agent-settings";
import type { TtsSpeakOptions } from "@/lib/voice/types";

function publicTraceHeader(payload: {
  requestId: string;
  httpStatus: number;
  fallbackToBrowser: boolean;
  languageCode?: string;
  endpoint?: string;
  failureReason?: string;
  recovered?: boolean;
  durationMs?: number;
  charsSent?: number;
}): Record<string, string> {
  return {
    "X-Voice-Trace": encodePublicTtsTraceHeader({
      event: "voice.tts.attempt",
      requestId: payload.requestId,
      httpStatus: payload.httpStatus,
      fallbackToBrowser: payload.fallbackToBrowser,
      languageCode: payload.languageCode,
      endpoint: payload.endpoint,
      failureReason: payload.failureReason,
      recovered: payload.recovered,
      durationMs: payload.durationMs,
      charsSent: payload.charsSent,
    }),
  };
}

function logRouteTtsOutcome(
  trace: TtsTraceContext,
  payload: {
    httpStatus: number;
    fallbackToBrowser: boolean;
    reason?: string;
    recovered?: boolean;
    endpoint?: string;
    elevenlabsErrorCode?: string;
    failureReason?: string;
    durationMs: number;
    /** Chars actually billed; 0 when ElevenLabs was not charged. */
    billedCharsSent?: number;
  },
): void {
  logTtsAttempt({
    requestId: trace.requestId,
    sessionUsageId: trace.sessionUsageId,
    turnId: trace.turnId,
    voiceIdCategory: "library",
    endpoint: payload.endpoint,
    httpStatus: payload.httpStatus,
    elevenlabsErrorCode: payload.elevenlabsErrorCode,
    failureReason: payload.failureReason ?? payload.reason,
    charsRequested: trace.charsRequested,
    charsSent: payload.billedCharsSent ?? trace.charsSent,
    sessionExtraTtsRemaining: trace.sessionExtraTtsRemaining,
    fallbackToBrowser: payload.fallbackToBrowser,
    durationMs: payload.durationMs,
    recovered: payload.recovered,
    languageCode: trace.languageCode ?? "es",
  });
}

function resolveTtsSpeakOptions(body: {
  voiceId?: string;
  language?: string;
  speakingRate?: number | string;
}): TtsSpeakOptions | undefined {
  const parsed = parseVoiceAgentSettings({
    voiceId: body.voiceId,
    language: body.language,
    speakingRate:
      body.speakingRate === 0.85 || body.speakingRate === "lento"
        ? "lento"
        : body.speakingRate === 1.15 || body.speakingRate === "rapido"
          ? "rapido"
          : "normal",
  });
  const options: TtsSpeakOptions = {};
  if (body.voiceId) options.voiceId = resolvePremadeVoiceId(body.voiceId);
  if (body.language) options.language = parsed.language;
  if (body.speakingRate !== undefined && body.speakingRate !== "") {
    const numeric =
      typeof body.speakingRate === "number"
        ? body.speakingRate
        : Number(body.speakingRate);
    options.speakingRate = Number.isFinite(numeric)
      ? clampSpeakingRate(numeric)
      : clampSpeakingRate(
          parsed.speakingRate === "lento"
            ? 0.85
            : parsed.speakingRate === "rapido"
              ? 1.15
              : 1,
        );
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

export async function POST(request: Request) {
  const requestId = createTtsRequestId();
  const routeStartedAt = Date.now();
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
    turnId?: string;
    voiceId?: string;
    language?: string;
    speakingRate?: number | string;
  };
  const rawText = body.text?.trim() ?? "";
  const sessionUsageId =
    body.sessionUsageId ?? request.headers.get("x-voice-session-id") ?? undefined;
  const turnId = body.turnId ?? request.headers.get("x-voice-turn-id") ?? undefined;
  const speakOptions = resolveTtsSpeakOptions(body);

  if (!rawText) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const { requestedChars, spokenText, sentChars } = truncateForBilledTts(rawText);
  let sessionExtraTtsRemaining: number | null = null;

  const baseTrace = (): TtsTraceContext => ({
    requestId,
    sessionUsageId,
    turnId,
    charsRequested: requestedChars,
    charsSent: sentChars,
    sessionExtraTtsRemaining,
    languageCode: speakOptions?.language ?? "es",
  });

  if (!isSpeakableTtsText(rawText)) {
    logRouteTtsOutcome(baseTrace(), {
      httpStatus: 400,
      fallbackToBrowser: true,
      reason: "not_speakable",
      durationMs: Date.now() - routeStartedAt,
      billedCharsSent: 0,
    });
    return NextResponse.json(
      { error: "not_speakable", fallbackToBrowser: true },
      {
        status: 400,
        headers: publicTraceHeader({
          requestId,
          httpStatus: 400,
          fallbackToBrowser: true,
          languageCode: speakOptions?.language ?? "es",
          failureReason: "not_speakable",
        }),
      },
    );
  }

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

    sessionExtraTtsRemaining = gate.sessionExtraTtsRemaining;

    if (!gate.allowed) {
      logRouteTtsOutcome(baseTrace(), {
        httpStatus: 429,
        fallbackToBrowser: true,
        reason: gate.reason,
        durationMs: Date.now() - routeStartedAt,
        billedCharsSent: 0,
      });
      return NextResponse.json(
        { error: gate.reason, fallbackToBrowser: true },
        {
          status: 429,
          headers: publicTraceHeader({
            requestId,
            httpStatus: 429,
            fallbackToBrowser: true,
            languageCode: speakOptions?.language ?? "es",
            failureReason: gate.reason,
          }),
        },
      );
    }
  }

  const synthesisStartedAt = Date.now();
  const synthesis = await synthesizeSpeech(spokenText, baseTrace(), speakOptions);

  if (isElevenLabsTier(tier) && sessionUsageId) {
    sessionExtraTtsRemaining = await withPgClient(async (client) => {
      const usage = await getSessionUsage(client, sessionUsageId);
      return usage ? sessionExtraTtsRemainingChars(usage) : 0;
    });
  }

  const lastFailure = synthesis.failures.at(-1);
  const synthesisDurationMs = Date.now() - synthesisStartedAt;

  if (!synthesis.result) {
    logRouteTtsOutcome(baseTrace(), {
      httpStatus: 502,
      fallbackToBrowser: true,
      reason: "synthesis_failed",
      endpoint: lastFailure?.endpoint,
      elevenlabsErrorCode: parseElevenLabsErrorCode(lastFailure?.detail),
      failureReason: lastFailure?.reason,
      durationMs: synthesisDurationMs,
      billedCharsSent: 0,
    });
    console.error("voice.tts.elevenlabs_failed", {
      requestId,
      sessionUsageId,
      turnId,
      recovered: false,
      textLength: sentChars,
      attempts: describeTtsFailures(synthesis.failures),
    });
    return NextResponse.json(
      {
        error: "Synthesis failed.",
        fallbackToBrowser: true,
        attempts: synthesis.failures,
      },
      {
        status: 502,
        headers: publicTraceHeader({
          requestId,
          httpStatus: 502,
          fallbackToBrowser: true,
          languageCode: speakOptions?.language ?? "es",
          endpoint: lastFailure?.endpoint,
          failureReason: lastFailure?.reason ?? "synthesis_failed",
          durationMs: synthesisDurationMs,
        }),
      },
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

  if (synthesis.failures.length > 0) {
    console.error("voice.tts.elevenlabs_failed", {
      requestId,
      sessionUsageId,
      turnId,
      recovered: true,
      textLength: sentChars,
      attempts: describeTtsFailures(synthesis.failures),
    });
  }

  logRouteTtsOutcome(baseTrace(), {
    httpStatus: 200,
    fallbackToBrowser: false,
    endpoint: result.endpoint,
    recovered: synthesis.failures.length > 0,
    durationMs: synthesisDurationMs,
  });

  return new NextResponse(new Uint8Array(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "X-Voice-Tier": result.tier,
      "X-Voice-Request-Id": requestId,
      ...(result.endpoint ? { "X-Voice-Endpoint": result.endpoint } : {}),
      ...publicTraceHeader({
        requestId,
        httpStatus: 200,
        fallbackToBrowser: false,
        languageCode: speakOptions?.language ?? "es",
        endpoint: result.endpoint,
        recovered: synthesis.failures.length > 0,
        durationMs: synthesisDurationMs,
        charsSent: sentChars,
      }),
    },
  });
}
