import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  isServerTtsTier,
  resolveTtsTier,
  isElevenLabsTier,
} from "@/lib/voice/ladder";
import { describeTtsFailures, synthesizeSpeech } from "@/lib/voice/tts";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { recordExtraTtsChars } from "@/lib/voice/usage";
import {
  assertSessionOwnership,
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";

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
  const text = body.text?.trim();
  const sessionUsageId =
    body.sessionUsageId ?? request.headers.get("x-voice-session-id") ?? undefined;

  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
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
        };
      }
      return gateElevenLabsCall(
        client,
        tier,
        {
          sessionUsageId,
          verifiedUserId: auth.verifiedUserId,
        },
        { ttsChars: text.length },
      );
    });

    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason, fallbackToBrowser: true },
        { status: 429 },
      );
    }
  }

  const synthesis = await synthesizeSpeech(text);

  // The browser discards the 502 body, so this log is the only place the
  // ElevenLabs reason survives. Details are secret-scrubbed upstream.
  if (synthesis.failures.length > 0) {
    console.error("voice.tts.elevenlabs_failed", {
      recovered: Boolean(synthesis.result),
      textLength: text.length,
      attempts: describeTtsFailures(synthesis.failures),
    });
  }

  if (!synthesis.result) {
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
    await withPgClient((client) =>
      recordExtraTtsChars(client, sessionUsageId, text.length),
    );
  }

  return new NextResponse(new Uint8Array(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "X-Voice-Tier": result.tier,
      ...(result.endpoint ? { "X-Voice-Endpoint": result.endpoint } : {}),
    },
  });
}
