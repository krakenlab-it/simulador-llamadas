import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  acquireConvaiSlot,
  getSessionUsage,
  recordConvaiSeconds,
  recordExtraTtsChars,
  recordTraineeAudioSeconds,
  releaseConvaiSlot,
  sessionConvaiRemainingSeconds,
  shouldWarnSessionConvai,
} from "@/lib/voice/usage";
import { gateElevenLabsCall } from "@/lib/voice/gates";

export async function GET(request: Request) {
  const sessionUsageId = new URL(request.url).searchParams.get("sessionUsageId");
  if (!sessionUsageId) {
    return NextResponse.json({ error: "sessionUsageId required" }, { status: 400 });
  }

  try {
    const usage = await withPgClient((client) =>
      getSessionUsage(client, sessionUsageId),
    );
    if (!usage) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({
      convaiSecondsUsed: usage.convaiSecondsUsed,
      traineeAudioSecondsUsed: usage.traineeAudioSecondsUsed,
      extraTtsCharsUsed: usage.extraTtsCharsUsed,
      remainingConvaiSeconds: sessionConvaiRemainingSeconds(usage),
      warnLowTime: shouldWarnSessionConvai(usage),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionUsageId?: string;
      convaiSeconds?: number;
      traineeAudioSeconds?: number;
      extraTtsChars?: number;
      releaseConvaiSlot?: boolean;
      acquireConvaiSlot?: boolean;
    };

    if (!body.sessionUsageId) {
      return NextResponse.json(
        { error: "sessionUsageId is required" },
        { status: 400 },
      );
    }

    const result = await withPgClient(async (client) => {
      if (body.acquireConvaiSlot) {
        const gate = await gateElevenLabsCall(client, "elevenlabs", {
          sessionUsageId: body.sessionUsageId,
        });
        if (!gate.allowed) return gate;
        const slot = await acquireConvaiSlot(client, body.sessionUsageId!);
        if (!slot.allowed) return slot;
      }

      if (body.releaseConvaiSlot) {
        await releaseConvaiSlot(client, body.sessionUsageId!);
      }

      if (body.convaiSeconds && body.convaiSeconds > 0) {
        const gate = await gateElevenLabsCall(
          client,
          "elevenlabs",
          { sessionUsageId: body.sessionUsageId },
        );
        if (!gate.allowed) return gate;
        await recordConvaiSeconds(client, body.sessionUsageId!, body.convaiSeconds);
      }

      if (body.traineeAudioSeconds && body.traineeAudioSeconds > 0) {
        const gate = await gateElevenLabsCall(
          client,
          "elevenlabs-scribe",
          { sessionUsageId: body.sessionUsageId },
          { audioSeconds: body.traineeAudioSeconds },
        );
        if (!gate.allowed) return gate;
        await recordTraineeAudioSeconds(
          client,
          body.sessionUsageId!,
          body.traineeAudioSeconds,
        );
      }

      if (body.extraTtsChars && body.extraTtsChars > 0) {
        const gate = await gateElevenLabsCall(
          client,
          "elevenlabs",
          { sessionUsageId: body.sessionUsageId },
          { ttsChars: body.extraTtsChars },
        );
        if (!gate.allowed) return gate;
        await recordExtraTtsChars(
          client,
          body.sessionUsageId!,
          body.extraTtsChars,
        );
      }

      const usage = await getSessionUsage(client, body.sessionUsageId!);
      return {
        allowed: true,
        fallbackToBrowser: false,
        usage,
        remainingConvaiSeconds: usage
          ? sessionConvaiRemainingSeconds(usage)
          : 0,
        warnLowTime: usage ? shouldWarnSessionConvai(usage) : false,
      };
    });

    if ("fallbackToBrowser" in result && result.fallbackToBrowser) {
      return NextResponse.json(result, { status: 429 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
