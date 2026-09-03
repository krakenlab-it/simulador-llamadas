import { NextResponse } from "next/server";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import {
  SessionService,
  createTrainee,
  findOrCreateTrainee,
  toPublicRouteError,
  withPgClient,
} from "@/lib/session";

interface CreateSessionBody {
  traineeId?: string;
  traineeDisplayName?: string;
  traineeEmail?: string;
  traineeAuthUserId?: string;
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
      const hasIdentity = Boolean(
        body.traineeEmail?.trim() || body.traineeAuthUserId?.trim(),
      );
      const traineeId =
        body.traineeId && !hasIdentity
          ? body.traineeId
          : hasIdentity
            ? await findOrCreateTrainee(client, {
                traineeId: body.traineeId,
                email: body.traineeEmail,
                authUserId: body.traineeAuthUserId,
                displayName: body.traineeDisplayName,
              })
            : await createTrainee(
                client,
                body.traineeDisplayName ?? "Trainee",
              );

      return service.startSession({
        traineeId,
        scenarioSlug: body.scenarioSlug,
        difficultyLevel: body.difficultyLevel,
        mode: body.mode,
      });
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const mapped = toPublicRouteError(error, "No se pudo iniciar la llamada.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
