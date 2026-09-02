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
import { GET as getSessionDetail } from "@/app/api/sessions/[id]/route";
import {
  SessionService,
  findOrCreateTrainee,
} from "@/lib/session";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("scored session list + detail round-trip", () => {
  let client: Client;
  let service: SessionService;
  let traineeId: string;
  const traineeEmail = `klm51-${Date.now()}@example.com`;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await ensureMigrated(client);
    service = new SessionService(client);
    traineeId = await findOrCreateTrainee(client, {
      email: traineeEmail,
      displayName: "Sebastian Dashboard",
    });
  });

  afterAll(async () => {
    await client?.end();
  });

  it("persists the KLM-50 scorecard and reloads it from list and detail", async () => {
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

    const ended = await service.endSession(session.callAttemptId);
    expect(ended.evaluation.scorecard).toBeDefined();
    expect(ended.totalScore).toBe(ended.evaluation.scorecard?.overallScore);

    const stored = await client.query<{
      evaluation_summary: { scorecard?: { overallScore: number } };
      total_score: string;
    }>(
      "SELECT evaluation_summary, total_score FROM call_attempts WHERE id = $1",
      [session.callAttemptId],
    );
    expect(stored.rows[0].evaluation_summary.scorecard?.overallScore).toBe(
      ended.totalScore,
    );
    expect(Number(stored.rows[0].total_score)).toBe(ended.totalScore);

    const sameTrainee = await findOrCreateTrainee(client, {
      email: traineeEmail,
    });
    expect(sameTrainee).toBe(traineeId);

    const listResponse = await getHistory(
      new Request(`http://localhost/api/history?email=${traineeEmail}`),
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as {
      history: Array<{
        callAttemptId: string;
        clientName: string;
        totalScore: number | null;
        turnsCompleted: number;
        durationSeconds: number | null;
      }>;
    };
    const listed = listBody.history.find(
      (item) => item.callAttemptId === session.callAttemptId,
    );
    expect(listed).toBeDefined();
    expect(listed?.clientName).toBe("Mariana Escobedo");
    expect(listed?.totalScore).toBe(ended.totalScore);
    expect(listed?.turnsCompleted).toBe(5);
    expect(listed?.durationSeconds).toBeGreaterThanOrEqual(0);

    const detailResponse = await getSessionDetail(
      new Request(`http://localhost/api/sessions/${session.callAttemptId}`),
      { params: Promise.resolve({ id: session.callAttemptId }) },
    );
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as {
      evaluation: { scorecard?: { overallScore: number }; nextDrill: string };
      totalScore: number | null;
      turns: Array<{ utterance: string }>;
      clientName: string;
    };
    expect(detail.clientName).toBe("Mariana Escobedo");
    expect(detail.totalScore).toBe(ended.totalScore);
    expect(detail.evaluation.scorecard?.overallScore).toBe(ended.totalScore);
    expect(detail.evaluation.nextDrill).toBe(ended.evaluation.nextDrill);
    expect(detail.turns).toHaveLength(5);
  });

  it("returns 404 for an unknown session detail", async () => {
    const response = await getSessionDetail(
      new Request("http://localhost/api/sessions/00000000-0000-0000-0000-000000000000"),
      {
        params: Promise.resolve({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      },
    );
    expect(response.status).toBe(404);
  });
});
