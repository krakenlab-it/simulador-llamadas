import { NextResponse } from "next/server";
import { SessionService, toPublicRouteError, withPgClient } from "@/lib/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const result = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.endSession(id);
    });

    return NextResponse.json(result);
  } catch (error) {
    const mapped = toPublicRouteError(error, "No se pudo finalizar la llamada.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
