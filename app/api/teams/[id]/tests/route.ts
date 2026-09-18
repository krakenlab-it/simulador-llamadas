import { NextResponse } from "next/server";
import {
  createTeamTest,
  findTest,
  getTeamSnapshot,
  recordResult,
  TeamStoreError,
} from "@/lib/teams";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      scenarioSlug?: string;
      title?: string;
      result?: {
        memberId: string;
        totalScore: number;
        won?: boolean;
        turnsCompleted?: number;
        notes?: string;
      };
      testId?: string;
    };

    if (body.result && body.testId) {
      const test = await findTest(body.testId);
      if (!test || test.teamId !== id) {
        throw new TeamStoreError("Examen no encontrado en este equipo.");
      }
      const snapshot = await getTeamSnapshot(id);
      if (
        !snapshot.members.some((member) => member.id === body.result!.memberId)
      ) {
        throw new TeamStoreError("Miembro no encontrado en este equipo.");
      }
      const result = await recordResult(body.testId, body.result);
      return NextResponse.json(result, { status: 201 });
    }

    const test = await createTeamTest(id, {
      scenarioSlug: body.scenarioSlug ?? "",
      title: body.title,
    });
    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    const status = error instanceof TeamStoreError ? 400 : 500;
    const message =
      error instanceof Error ? error.message : "No se pudo crear el examen.";
    return NextResponse.json({ error: message }, { status });
  }
}
