import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import { getConvaiSignedUrl } from "@/lib/voice/providers/elevenlabs";
import { isBilledElevenLabsPathAvailable } from "@/lib/voice/gates";
import { acquireConvaiSlot, releaseConvaiSlot } from "@/lib/voice/usage";
import { gateElevenLabsCall } from "@/lib/voice/gates";

export async function POST(request: Request) {
  if (!isBilledElevenLabsPathAvailable()) {
    return NextResponse.json(
      { error: "ConvAI not configured.", fallbackToBrowser: true },
      { status: 503 },
    );
  }

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

  const gate = await withPgClient((client) =>
    gateElevenLabsCall(client, "elevenlabs", { sessionUsageId }),
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

  const signedUrl = await getConvaiSignedUrl(clientName, scenarioContext);
  if (!signedUrl) {
    await withPgClient((client) => releaseConvaiSlot(client, sessionUsageId));
    return NextResponse.json(
      { error: "Could not obtain ConvAI session.", fallbackToBrowser: true },
      { status: 502 },
    );
  }

  return NextResponse.json({ signedUrl, sessionUsageId });
}
