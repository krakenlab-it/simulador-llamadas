import { NextResponse } from "next/server";
import { addMember, teamErrorMessage, TeamStoreError } from "@/lib/teams";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      displayName?: string;
      email?: string;
    };
    const member = await addMember(id, {
      displayName: body.displayName ?? "",
      email: body.email ?? null,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const status = error instanceof TeamStoreError ? 400 : 500;
    const message = teamErrorMessage(error, "No se pudo agregar el miembro.");
    return NextResponse.json({ error: message }, { status });
  }
}
