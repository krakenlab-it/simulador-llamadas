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
import { SessionRepository, SessionService, createTrainee } from "@/lib/session";
import { POST as submitTurnRoute } from "@/app/api/sessions/[id]/turns/route";
import { SESSION_MAX_TURN_ALLOCATIONS } from "@/lib/voice/brakes";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function turnRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/sessions/x/turns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The exact shape Sebastián saw in prod: raw PG text inside a 400 body. */
function assertNoDriverText(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/duplicate key/i);
  expect(serialized).not.toMatch(/unique constraint/i);
  expect(serialized).not.toMatch(/call_turns_call_attempt_id_round_number_key/);
}

describeIfDb("turn allocation (integration)", () => {
  let client: Client;
  let service: SessionService;
  let traineeId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await ensureMigrated(client);
    service = new SessionService(client);
    traineeId = await createTrainee(client, "Turn Allocation Trainee");
  });

  afterAll(async () => {
    await client?.end();
  });

  async function startSession() {
    return service.startSession({
      traineeId,
      scenarioSlug: "mariana",
      difficultyLevel: 2,
      mode: "voz",
    });
  }

  it("assigns strictly increasing round numbers across sequential turns", async () => {
    const session = await startSession();

    const rounds: number[] = [];
    for (const utterance of [
      APERTURA_UTTERANCE,
      OBJECION_UTTERANCE,
      CLARIDAD_UTTERANCE,
    ]) {
      const turn = await service.submitTurn({
        callAttemptId: session.callAttemptId,
        utterance,
      });
      rounds.push(turn.roundNumber);
      expect(turn.clientReply).toBeTruthy();
    }

    expect(rounds).toEqual([1, 2, 3]);
  });

  it("returns the stored turn when the same submit is retried", async () => {
    const session = await startSession();
    const clientTurnId = "3f6f1a5e-2b1e-4c0a-9a1b-0f1f2a3b4c5d";

    const first = await service.submitTurn({
      callAttemptId: session.callAttemptId,
      utterance: APERTURA_UTTERANCE,
      clientTurnId,
    });
    const retry = await service.submitTurn({
      callAttemptId: session.callAttemptId,
      utterance: APERTURA_UTTERANCE,
      clientTurnId,
    });

    expect(retry.turnId).toBe(first.turnId);
    expect(retry.roundNumber).toBe(1);
    expect(retry.clientReply).toBe(first.clientReply);
    expect(retry.roundScore).toBe(first.roundScore);

    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM call_turns WHERE call_attempt_id = $1",
      [session.callAttemptId],
    );
    expect(rows[0].count).toBe("1");
  });

  it("never raises a unique violation when two submits race", async () => {
    const session = await startSession();

    const otherClient = new Client({ connectionString: databaseUrl });
    await otherClient.connect();

    try {
      const results = await Promise.all([
        service.submitTurn({
          callAttemptId: session.callAttemptId,
          utterance: APERTURA_UTTERANCE,
        }),
        new SessionService(otherClient).submitTurn({
          callAttemptId: session.callAttemptId,
          utterance: OBJECION_UTTERANCE,
        }),
      ]);

      const rounds = results.map((turn) => turn.roundNumber).sort();
      expect(rounds).toEqual([1, 2]);
    } finally {
      await otherClient.end();
    }
  });

  it("allows follow-up turns after the five clinic phases", async () => {
    const session = await startSession();

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

    const sixth = await service.submitTurn({
      callAttemptId: session.callAttemptId,
      utterance:
        "¿Le parece el martes a las 10:30 para revisar el impacto en visitas a caseta?",
    });

    expect(sixth.roundNumber).toBe(6);
    expect(sixth.roundType).toBe("cierre");
    expect(sixth.roundKey).toBe("cierre-6");
    expect(sixth.clientReply).toBeTruthy();
  });

  it("rejects turns beyond the allocation safety cap", async () => {
    const session = await startSession();

    for (let round = 1; round <= SESSION_MAX_TURN_ALLOCATIONS; round += 1) {
      await service.submitTurn({
        callAttemptId: session.callAttemptId,
        utterance: `${APERTURA_UTTERANCE} ronda ${round}`,
      });
    }

    const thrown = await service
      .submitTurn({
        callAttemptId: session.callAttemptId,
        utterance: GOOD_CLOSE_UTTERANCE,
      })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(thrown).toMatchObject({ code: "rounds_completed" });
    assertNoDriverText({ error: (thrown as Error).message });
  });

  it("frees the round when scoring fails so the trainee can retry", async () => {
    const session = await startSession();
    const repository = new SessionRepository(client);

    const slot = await repository.reserveTurnSlot(
      session.callAttemptId,
      APERTURA_UTTERANCE,
      { clientTurnId: null },
    );
    expect(slot.kind).toBe("reserved");
    if (slot.kind !== "reserved") throw new Error("expected a reservation");

    await repository.releaseTurnSlot(slot.turnId);

    const turn = await service.submitTurn({
      callAttemptId: session.callAttemptId,
      utterance: APERTURA_UTTERANCE,
    });
    expect(turn.roundNumber).toBe(1);
  });

  it("POST /turns answers a duplicate submit without leaking SQL", async () => {
    const session = await startSession();
    const clientTurnId = "8c1d2e3f-4a5b-4c7d-8e9f-0a1b2c3d4e5f";

    const first = await submitTurnRoute(
      turnRequest({ utterance: APERTURA_UTTERANCE, clientTurnId }),
      routeContext(session.callAttemptId),
    );
    const second = await submitTurnRoute(
      turnRequest({ utterance: APERTURA_UTTERANCE, clientTurnId }),
      routeContext(session.callAttemptId),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = (await first.json()) as { turnId: string; roundNumber: number };
    const secondBody = (await second.json()) as { turnId: string; roundNumber: number };

    expect(secondBody.turnId).toBe(firstBody.turnId);
    expect(secondBody.roundNumber).toBe(1);
    assertNoDriverText(secondBody);
  });

  it("POST /turns keeps rounds ordered when the client fires twice at once", async () => {
    const session = await startSession();

    const [first, second] = await Promise.all([
      submitTurnRoute(
        turnRequest({ utterance: APERTURA_UTTERANCE }),
        routeContext(session.callAttemptId),
      ),
      submitTurnRoute(
        turnRequest({ utterance: OBJECION_UTTERANCE }),
        routeContext(session.callAttemptId),
      ),
    ]);

    const bodies = [await first.json(), await second.json()] as Array<{
      roundNumber?: number;
      error?: string;
    }>;

    expect([first.status, second.status]).not.toContain(400);
    bodies.forEach(assertNoDriverText);
    expect(bodies.map((body) => body.roundNumber).sort()).toEqual([1, 2]);
  });

  it("POST /turns reports a finished call as a conflict only past the allocation cap", async () => {
    const session = await startSession();

    for (let round = 1; round <= SESSION_MAX_TURN_ALLOCATIONS; round += 1) {
      await submitTurnRoute(
        turnRequest({ utterance: `${APERTURA_UTTERANCE} ronda ${round}` }),
        routeContext(session.callAttemptId),
      );
    }

    const extra = await submitTurnRoute(
      turnRequest({ utterance: GOOD_CLOSE_UTTERANCE }),
      routeContext(session.callAttemptId),
    );
    const body = (await extra.json()) as { error: string; code: string };

    expect(extra.status).toBe(409);
    expect(body.code).toBe("rounds_completed");
    assertNoDriverText(body);
  });
});
