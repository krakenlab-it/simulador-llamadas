import { NextResponse } from "next/server";
import {
  createDefaultSessionSeed,
  enrichCohortWithPersonas,
  isValidCohort,
  type KrakenLabCohortConfig,
} from "@/lib/kraken-lab";
import { KrakenLabRepository } from "@/lib/kraken-lab/repository";
import { withPgClient } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<KrakenLabCohortConfig>;
    const cohort: KrakenLabCohortConfig = {
      ...(body as KrakenLabCohortConfig),
      sessionSeed: body.sessionSeed?.trim() || createDefaultSessionSeed(body),
    };

    const enriched = enrichCohortWithPersonas(cohort);
    if (!isValidCohort(enriched)) {
      return NextResponse.json(
        { error: "Configuración de cohorte incompleta o inválida" },
        { status: 400 },
      );
    }

    const result = await withPgClient(async (client) => {
      const repo = new KrakenLabRepository(client);
      return repo.saveCohort(enriched);
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la cohorte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
