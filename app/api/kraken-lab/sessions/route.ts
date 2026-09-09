import { NextResponse } from "next/server";
import type { PracticeMode } from "@/lib/db/types";
import type { AgenticRuntimeConfig } from "@/lib/agentic/types";
import {
  createDefaultSessionSeed,
  enrichCohortWithPersonas,
  isValidCohort,
  type KrakenLabCohortConfig,
} from "@/lib/kraken-lab";
import { startKrakenLabSession } from "@/lib/kraken-lab/repository";
import {
  createTrainee,
  findOrCreateTrainee,
  toPublicRouteError,
  withPgClient,
} from "@/lib/session";

interface StartKrakenSessionBody {
  cohort: Partial<KrakenLabCohortConfig>;
  mode: PracticeMode;
  traineeId?: string;
  traineeEmail?: string;
  traineeAuthUserId?: string;
  traineeDisplayName?: string;
  agenticRuntime?: AgenticRuntimeConfig;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartKrakenSessionBody;

    if (!body.mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    const cohort: KrakenLabCohortConfig = {
      ...(body.cohort as KrakenLabCohortConfig),
      sessionSeed:
        body.cohort.sessionSeed?.trim() ||
        createDefaultSessionSeed(body.cohort),
    };

    const enriched = enrichCohortWithPersonas(cohort);
    if (!isValidCohort(enriched)) {
      return NextResponse.json(
        { error: "Configuración de cohorte incompleta o inválida" },
        { status: 400 },
      );
    }

    const session = await withPgClient(async (client) => {
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
                body.traineeDisplayName ?? "Pasante",
              );

      return startKrakenLabSession(client, {
        cohort: enriched,
        traineeId,
        mode: body.mode,
        agenticRuntime: body.agenticRuntime,
      });
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const mapped = toPublicRouteError(
      error,
      "No se pudo iniciar la simulación Kraken Lab.",
    );
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
