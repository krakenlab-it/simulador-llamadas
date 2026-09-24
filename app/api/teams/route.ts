import { NextResponse } from "next/server";
import {
  createTeam,
  listTeams,
  teamErrorMessage,
  TeamStoreError,
} from "@/lib/teams";

export async function GET() {
  try {
    const teams = await listTeams();
    return NextResponse.json({ teams });
  } catch (error) {
    const message = teamErrorMessage(
      error,
      "No se pudieron listar los equipos.",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; createdBy?: string };
    const team = await createTeam({
      name: body.name ?? "",
      createdBy: body.createdBy ?? null,
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    const status = error instanceof TeamStoreError ? 400 : 500;
    const message = teamErrorMessage(error, "No se pudo crear el equipo.");
    return NextResponse.json({ error: message }, { status });
  }
}
