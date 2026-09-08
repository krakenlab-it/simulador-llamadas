import { NextResponse } from "next/server";
import { KrakenLabRepository } from "@/lib/kraken-lab/repository";
import { withPgClient } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cohort = await withPgClient(async (client) => {
      const repo = new KrakenLabRepository(client);
      return repo.getCohort(id);
    });

    if (!cohort) {
      return NextResponse.json({ error: "Cohorte no encontrada" }, { status: 404 });
    }

    return NextResponse.json(cohort);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar la cohorte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
