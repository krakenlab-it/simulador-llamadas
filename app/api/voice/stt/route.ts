import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import { transcribeAudio } from "@/lib/voice/stt";
import {
  isServerSttTier,
  resolveSttTier,
  isElevenLabsTier,
} from "@/lib/voice/ladder";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { recordTraineeAudioSeconds } from "@/lib/voice/usage";

function estimateAudioSeconds(byteLength: number): number {
  return Math.max(1, Math.ceil(byteLength / 16_000));
}

export async function POST(request: Request) {
  const tier = resolveSttTier();
  if (!isServerSttTier(tier)) {
    return NextResponse.json(
      { error: "Server STT not configured; use browser fallback.", fallbackToBrowser: true },
      { status: 503 },
    );
  }

  const sessionUsageId = request.headers.get("x-voice-session-id") ?? undefined;
  const contentType = request.headers.get("content-type") ?? "";

  let audioBytes: Buffer;
  let mimeType = "audio/webm";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio field." }, { status: 400 });
    }
    mimeType = file.type || mimeType;
    audioBytes = Buffer.from(await file.arrayBuffer());
  } else {
    const body = (await request.json()) as {
      audioBase64?: string;
      mimeType?: string;
      sessionUsageId?: string;
    };
    if (!body.audioBase64) {
      return NextResponse.json({ error: "Missing audioBase64." }, { status: 400 });
    }
    mimeType = body.mimeType ?? mimeType;
    audioBytes = Buffer.from(body.audioBase64, "base64");
  }

  if (audioBytes.length === 0) {
    return NextResponse.json({ error: "Empty audio." }, { status: 400 });
  }

  const audioSeconds = estimateAudioSeconds(audioBytes.length);

  if (isElevenLabsTier(tier)) {
    const gate = await withPgClient((client) =>
      gateElevenLabsCall(
        client,
        tier,
        { sessionUsageId },
        { audioSeconds },
      ),
    );
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason, fallbackToBrowser: true },
        { status: 429 },
      );
    }
  }

  const result = await transcribeAudio(audioBytes, mimeType);
  if (!result) {
    return NextResponse.json(
      { error: "Transcription failed.", fallbackToBrowser: true },
      { status: 502 },
    );
  }

  if (isElevenLabsTier(result.tier) && sessionUsageId) {
    await withPgClient((client) =>
      recordTraineeAudioSeconds(client, sessionUsageId, audioSeconds),
    );
  }

  return NextResponse.json(result);
}
