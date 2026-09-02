import { NextResponse } from "next/server";
import {
  SessionService,
  findTraineeId,
  withPgClient,
} from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const traineeIdParam = url.searchParams.get("traineeId");
    const email = url.searchParams.get("email");
    const scenarioSlug = url.searchParams.get("scenarioSlug") ?? undefined;

    if (!traineeIdParam && !email) {
      return NextResponse.json(
        { error: "traineeId or email query parameter is required" },
        { status: 400 },
      );
    }

    const history = await withPgClient(async (client) => {
      const traineeId =
        traineeIdParam ??
        (await findTraineeId(client, { email }));

      if (!traineeId) return [];

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
