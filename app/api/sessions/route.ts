import { NextResponse } from "next/server";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import {
  SessionService,
  createTrainee,
  withPgClient,
} from "@/lib/session";

interface CreateSessionBody {
  traineeId?: string;
  traineeDisplayName?: string;
  scenarioSlug: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSessionBody;

    if (!body.scenarioSlug || !body.difficultyLevel || !body.mode) {
      return NextResponse.json(
        { error: "scenarioSlug, difficultyLevel, and mode are required" },
        { status: 400 },
      );
    }

    const session = await withPgClient(async (client) => {
      const service = new SessionService(client);
      let traineeId = body.traineeId;

      if (!traineeId) {
        traineeId = await createTrainee(
          client,
          body.traineeDisplayName ?? "Trainee",
        );
      }

      return service.startSession({
        traineeId,
        scenarioSlug: body.scenarioSlug,
        difficultyLevel: body.difficultyLevel,
        mode: body.mode,
      });
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
