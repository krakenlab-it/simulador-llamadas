import { NextResponse } from "next/server";
import {
  generateTeamComparison,
  teamErrorMessage,
  TeamStoreError,
} from "@/lib/teams";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const testId = new URL(request.url).searchParams.get("testId");
    if (!testId) {
      return NextResponse.json(
        { error: "Falta testId para comparar el mismo examen." },
        { status: 400 },
      );
    }
    const comparison = await generateTeamComparison(id, testId);
    return NextResponse.json(comparison);
  } catch (error) {
    const status = error instanceof TeamStoreError ? 404 : 500;
    const message = teamErrorMessage(error, "No se pudo comparar.");
    return NextResponse.json({ error: message }, { status });
  }
}
