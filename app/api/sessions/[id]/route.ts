import { NextResponse } from "next/server";
import { SessionService, toPublicRouteError, withPgClient } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const detail = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.getSessionDetail(id);
    });

    if (!detail) {
      return NextResponse.json(
        { error: "No encontramos esta llamada." },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    const mapped = toPublicRouteError(error, "No se pudo abrir esta llamada.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
