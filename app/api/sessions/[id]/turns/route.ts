import { NextResponse } from "next/server";
import { SessionService, withPgClient } from "@/lib/session";

interface SubmitTurnBody {
  utterance: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as SubmitTurnBody;

    if (!body.utterance?.trim()) {
      return NextResponse.json({ error: "utterance is required" }, { status: 400 });
    }

    const turn = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.submitTurn({
        callAttemptId: id,
        utterance: body.utterance,
      });
    });

    return NextResponse.json(turn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
