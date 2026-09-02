import { NextResponse } from "next/server";
import { SessionError, SessionService, withPgClient } from "@/lib/session";

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
    if (error instanceof SessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
