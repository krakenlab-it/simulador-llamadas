import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  APERTURA_UTTERANCE,
  CLARIDAD_UTTERANCE,
  CORREO_UTTERANCE,
  GOOD_CLOSE_UTTERANCE,
  OBJECION_UTTERANCE,
} from "../fixtures/scoring/utterances";
import { ensureMigrated } from "../helpers/db";
import { GET as getHistory } from "@/app/api/history/route";
import { SessionService, createTrainee } from "@/lib/session";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("call history API", () => {
  let client: Client;
  let service: SessionService;
  let traineeId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await ensureMigrated(client);
    service = new SessionService(client);
    traineeId = await createTrainee(client, "History Test Trainee");
  });

  afterAll(async () => {
    await client?.end();
  });

  it("returns empty history for a trainee with no attempts", async () => {
    const otherTraineeId = await createTrainee(client, "Empty Trainee");
    const history = await service.listHistory(otherTraineeId);
    expect(history).toEqual([]);
  });

  it("lists completed attempts from call_history view", async () => {
    const session = await service.startSession({
      traineeId,
      scenarioSlug: "mariana",
      difficultyLevel: 2,
      mode: "texto",
    });

    for (const utterance of [
      APERTURA_UTTERANCE,
      OBJECION_UTTERANCE,
      CLARIDAD_UTTERANCE,
      CORREO_UTTERANCE,
      GOOD_CLOSE_UTTERANCE,
    ]) {
      await service.submitTurn({
        callAttemptId: session.callAttemptId,
        utterance,
      });
    }

    await service.endSession(session.callAttemptId);

    const history = await service.listHistory(traineeId);
    const entry = history.find(
      (item) => item.callAttemptId === session.callAttemptId,
    );

    expect(entry).toBeDefined();
    expect(entry?.scenarioSlug).toBe("mariana");
    expect(entry?.clientName).toBe("Mariana Escobedo");
    expect(entry?.status).toBe("completed");
    expect(entry?.turnsCompleted).toBe(5);
    expect(entry?.won).toBe(true);
  });

  it("GET /api/history returns JSON for traineeId query param", async () => {
    const response = await getHistory(
      new Request(`http://localhost/api/history?traineeId=${traineeId}`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      history: Array<{ callAttemptId: string; scenarioSlug: string }>;
    };
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThan(0);
    expect(["mariana", "rodrigo", "efrain"]).toContain(body.history[0].scenarioSlug);
  });

  it("GET /api/history requires traineeId", async () => {
    const response = await getHistory(
      new Request("http://localhost/api/history"),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("traineeId");
  });
});
