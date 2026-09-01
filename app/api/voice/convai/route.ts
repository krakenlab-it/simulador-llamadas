import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  assertSessionOwnership,
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";
import { getConvaiSignedUrl } from "@/lib/voice/providers/elevenlabs";
import { isBilledElevenLabsPathAvailable } from "@/lib/voice/gates";
import { acquireConvaiSlot, releaseConvaiSlot } from "@/lib/voice/usage";
import { gateElevenLabsCall } from "@/lib/voice/gates";
import { resolveVoiceLadder } from "@/lib/voice/ladder";

export async function POST(request: Request) {
  // ConvAI is opt-in; without it the call runs on browser mic + TTS and no
  // agent is ever created.
  if (!resolveVoiceLadder().convaiEnabled || !isBilledElevenLabsPathAvailable()) {
    return NextResponse.json(
      { error: "convai_disabled", fallbackToBrowser: true },
      { status: 503 },
    );
  }

  const auth = await resolveVoiceAuth(request);
  if (!isVoiceAuthContext(auth)) return auth;

  const body = (await request.json()) as {
    clientName?: string;
    scenarioContext?: string;
    sessionUsageId?: string;
  };

  const sessionUsageId = body.sessionUsageId;
  if (!sessionUsageId) {
    return NextResponse.json(
      { error: "sessionUsageId required for billed ConvAI.", fallbackToBrowser: true },
      { status: 400 },
    );
  }

  const owned = await withPgClient((client) =>
    assertSessionOwnership(client, sessionUsageId, auth.verifiedUserId),
  );
  if (!owned) {
    return NextResponse.json(
      { error: "session_forbidden", fallbackToBrowser: true },
      { status: 403 },
    );
  }

  const gate = await withPgClient((client) =>
    gateElevenLabsCall(client, "elevenlabs", {
      sessionUsageId,
      verifiedUserId: auth.verifiedUserId,
    }),
  );
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, fallbackToBrowser: true },
      { status: 429 },
    );
  }

  const slotResult = await withPgClient((client) =>
    acquireConvaiSlot(client, sessionUsageId),
  );
  if (!slotResult.allowed) {
    return NextResponse.json(
      { error: slotResult.reason, fallbackToBrowser: true },
      { status: 429 },
    );
  }

  const clientName = body.clientName?.trim() || "Cliente";
  const scenarioContext =
    body.scenarioContext?.trim() || "Estás evaluando una propuesta comercial.";

  const result = await getConvaiSignedUrl(clientName, scenarioContext);
  if (!result.ok) {
    await withPgClient((client) => releaseConvaiSlot(client, sessionUsageId));
    const status = result.status >= 400 && result.status < 600 ? result.status : 502;
    return NextResponse.json(
      {
        error: "convai_unavailable",
        detail: result.detail,
        fallbackToBrowser: true,
      },
      { status },
    );
  }

  return NextResponse.json({
    signedUrl: result.signedUrl,
    agentId: result.agentId,
    sessionUsageId,
  });
}
