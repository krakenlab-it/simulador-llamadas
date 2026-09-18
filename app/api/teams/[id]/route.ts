import { NextResponse } from "next/server";
import { getTeamSnapshot, TeamStoreError } from "@/lib/teams";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const snapshot = await getTeamSnapshot(id);
    return NextResponse.json(snapshot);
  } catch (error) {
    const status = error instanceof TeamStoreError ? 404 : 500;
    const message =
      error instanceof Error ? error.message : "No se pudo cargar el equipo.";
    return NextResponse.json({ error: message }, { status });
  }
}
