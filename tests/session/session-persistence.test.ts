import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  APERTURA_UTTERANCE,
  CLARIDAD_UTTERANCE,
  CORREO_UTTERANCE,
  FAIL_CLOSE_UTTERANCE,
  GOOD_CLOSE_UTTERANCE,
  OBJECION_UTTERANCE,
} from "../fixtures/scoring/utterances";
import { ensureMigrated } from "../helpers/db";
import { SessionService, createTrainee } from "@/lib/session";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("session persistence (integration)", () => {
  let client: Client;
  let service: SessionService;
  let traineeId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await ensureMigrated(client);
    service = new SessionService(client);
    traineeId = await createTrainee(client, "Integration Trainee");
  });

  afterAll(async () => {
    await client?.end();
  });

  it("persists a full call attempt with winning close", async () => {
    const session = await service.startSession({
      traineeId,
      scenarioSlug: "mariana",
      difficultyLevel: 2,
      mode: "texto",
    });

    const utterances = [
      APERTURA_UTTERANCE,
      OBJECION_UTTERANCE,
      CLARIDAD_UTTERANCE,
      CORREO_UTTERANCE,
      GOOD_CLOSE_UTTERANCE,
    ];

    for (const utterance of utterances) {
      const turn = await service.submitTurn({
        callAttemptId: session.callAttemptId,
        utterance,
      });
      expect(turn.roundScore).toBeGreaterThanOrEqual(0);
      expect(["bien", "medio", "mal"]).toContain(turn.clientReaction);
      expect(turn.clientReply).toBeTruthy();
    }

    const ended = await service.endSession(session.callAttemptId);
    expect(ended.won).toBe(true);
    expect(ended.turnsCompleted).toBe(5);
    expect(ended.totalScore).toBeGreaterThan(0);

    const { rows } = await client.query(
      "SELECT status, won, total_score FROM call_attempts WHERE id = $1",
      [session.callAttemptId],
    );
    expect(rows[0].status).toBe("completed");
    expect(rows[0].won).toBe(true);
  });

  it("persists a failed close attempt", async () => {
    const session = await service.startSession({
      traineeId,
      scenarioSlug: "rodrigo",
      difficultyLevel: 3,
      mode: "texto",
    });

    const utterances = [
      APERTURA_UTTERANCE,
      OBJECION_UTTERANCE,
      CLARIDAD_UTTERANCE,
      CORREO_UTTERANCE,
      FAIL_CLOSE_UTTERANCE,
    ];

    for (const utterance of utterances) {
      await service.submitTurn({
        callAttemptId: session.callAttemptId,
        utterance,
      });
    }

    const ended = await service.endSession(session.callAttemptId);
    expect(ended.won).toBe(false);
    expect(ended.turnsCompleted).toBe(5);

    const { rows } = await client.query(
      "SELECT won FROM call_attempts WHERE id = $1",
      [session.callAttemptId],
    );
    expect(rows[0].won).toBe(false);
  });
});
