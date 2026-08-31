import { NextResponse } from "next/server";
import { SessionService, withPgClient } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const traineeId = new URL(request.url).searchParams.get("traineeId");

    if (!traineeId) {
      return NextResponse.json(
        { error: "traineeId query parameter is required" },
        { status: 400 },
      );
    }

    const history = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.listHistory(traineeId);
    });

    return NextResponse.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
