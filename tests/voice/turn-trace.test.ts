import { afterEach, describe, expect, it, vi } from "vitest";
import { logTurnSubmit } from "@/lib/voice/turn-trace";

describe("turn-trace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logTurnSubmit emits JSON with round and http status on success", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logTurnSubmit({
      callAttemptId: "call-1",
      roundNumber: 3,
      turnId: "turn-9",
      clientTurnId: "client-uuid",
      httpStatus: 200,
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      event: "voice.turn.submit",
      callAttemptId: "call-1",
      roundNumber: 3,
      turnId: "turn-9",
      clientTurnId: "client-uuid",
      httpStatus: 200,
    });
  });

  it("logTurnSubmit records 409 conflict codes", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logTurnSubmit({
      callAttemptId: "call-1",
      httpStatus: 409,
      code: "turn_conflict",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.code).toBe("turn_conflict");
    expect(payload.httpStatus).toBe(409);
    expect(payload.roundNumber).toBeUndefined();
  });
});
