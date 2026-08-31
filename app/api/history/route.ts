import { NextResponse } from "next/server";
import { SessionService, withPgClient } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const traineeId = url.searchParams.get("traineeId");
    const scenarioSlug = url.searchParams.get("scenarioSlug") ?? undefined;

    if (!traineeId) {
      return NextResponse.json(
        { error: "traineeId query parameter is required" },
        { status: 400 },
      );
    }

    const history = await withPgClient(async (client) => {
      const service = new SessionService(client);
      return service.listHistory(traineeId, scenarioSlug);
    });

    const completed = history.filter((h) => h.status === "completed");
    const trend =
      completed.length >= 2
        ? {
            attempts: completed.length,
            scores: completed.map((h) => h.totalScore).reverse(),
            averageScore:
              completed.reduce((s, h) => s + (h.totalScore ?? 0), 0) /
              completed.length,
            improving:
              (completed[0].totalScore ?? 0) >
              (completed[completed.length - 1].totalScore ?? 0),
          }
        : null;

    return NextResponse.json({ history, trend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
