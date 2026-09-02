import { NextResponse } from "next/server";
import { SessionError, SessionService, toSessionError, withPgClient } from "@/lib/session";
import { logTurnSubmit } from "@/lib/voice/turn-trace";

interface SubmitTurnBody {
  utterance?: string;
  clientTurnId?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let clientTurnId: string | null = null;

  try {
    const body = await request
      .json()
      .then((parsed) => parsed as SubmitTurnBody)
      .catch(() => {
        throw new SessionError("invalid_request");
      });

    if (!body.utterance?.trim()) {
      throw new SessionError("empty_utterance");
    }

    clientTurnId =
      body.clientTurnId && UUID_PATTERN.test(body.clientTurnId)
        ? body.clientTurnId
        : null;

    const turn = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.submitTurn({
        callAttemptId: id,
        utterance: body.utterance!,
        clientTurnId,
      });
    });

    logTurnSubmit({
      callAttemptId: id,
      roundNumber: turn.roundNumber,
      turnId: turn.turnId,
      clientTurnId,
      httpStatus: 200,
    });

    return NextResponse.json(turn);
  } catch (error) {
    const sessionError = toSessionError(error);
    if (sessionError.code === "turn_failed" || sessionError.code === "schema_outdated") {
      console.error("submitTurn failed", error);
    }
    logTurnSubmit({
      callAttemptId: id,
      clientTurnId,
      httpStatus: sessionError.httpStatus,
      code: sessionError.code,
    });
    return NextResponse.json(
      { error: sessionError.message, code: sessionError.code },
      { status: sessionError.httpStatus },
    );
  }
}
