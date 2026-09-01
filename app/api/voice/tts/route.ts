import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  isServerTtsTier,
  resolveTtsTier,
  isElevenLabsTier,
} from "@/lib/voice/ladder";
import { synthesizeSpeech } from "@/lib/voice/tts";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { recordExtraTtsChars } from "@/lib/voice/usage";

export async function POST(request: Request) {
  const tier = resolveTtsTier();
  if (!isServerTtsTier(tier)) {
    return NextResponse.json(
      { error: "Server TTS not configured; use browser fallback.", fallbackToBrowser: true },
      { status: 503 },
    );
  }

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
    const gate = await withPgClient((client) =>
      gateElevenLabsCall(
        client,
        tier,
        { sessionUsageId },
        { ttsChars: text.length },
      ),
    );
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason, fallbackToBrowser: true },
        { status: 429 },
      );
    }
  }

  const result = await synthesizeSpeech(text);
  if (!result) {
    return NextResponse.json(
      { error: "Synthesis failed.", fallbackToBrowser: true },
      { status: 502 },
    );
  }

  if (isElevenLabsTier(result.tier) && sessionUsageId) {
    await withPgClient((client) =>
      recordExtraTtsChars(client, sessionUsageId, text.length),
    );
  }

  return new NextResponse(new Uint8Array(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "X-Voice-Tier": result.tier,
    },
  });
}
