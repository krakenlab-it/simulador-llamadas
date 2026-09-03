import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  listHistory,
  listScenarios,
  saveScenarioVoiceAgent,
  submitTurn,
} from "@/lib/api/client";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

async function messageFromFailedTurn(): Promise<string> {
  try {
    await submitTurn("call-1", { utterance: "hola" });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected submitTurn to reject");
}

describe("api client error messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the server message instead of the raw JSON envelope", async () => {
    mockFetchOnce(409, {
      error: "Ese turno ya se registró. Espera la respuesta del cliente.",
      code: "turn_conflict",
    });

    await expect(
      submitTurn("call-1", { utterance: "hola" }),
    ).rejects.toThrowError("Ese turno ya se registró. Espera la respuesta del cliente.");
  });

  it("never shows Postgres constraint text in a toast", async () => {
    mockFetchOnce(400, {
      error:
        'duplicate key value violates unique constraint "call_turns_call_attempt_id_round_number_key"',
    });

    const message = await messageFromFailedTurn();

    expect(message).not.toMatch(/duplicate key/i);
    expect(message).not.toMatch(/unique constraint/i);
    expect(message).toBe("No se pudo completar la acción. Intenta de nuevo.");
  });

  it("falls back to a readable message for an empty error body", async () => {
    mockFetchOnce(400, "");

    expect(await messageFromFailedTurn()).toBe(
      "No se pudo completar la acción. Intenta de nuevo.",
    );
  });

  it("reports a server failure instead of silently switching to the demo stub", async () => {
    mockFetchOnce(503, {
      error:
        "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
      code: "schema_outdated",
    });

    expect(await messageFromFailedTurn()).toBe(
      "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
    );
  });

  it("does not start a stub call when POST /api/sessions returns 500", async () => {
    mockFetchOnce(500, {
      error:
        "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
      code: "schema_outdated",
    });

    await expect(
      createSession({
        scenarioSlug: "mariana",
        mode: "texto",
        difficultyLevel: 1,
      }),
    ).rejects.toThrow(
      "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
    );
  });

  it("does not hide a 500 behind the clinic stub list", async () => {
    mockFetchOnce(500, { error: 'column "voice_agent" does not exist' });

    await expect(listScenarios()).rejects.toThrow(
      "No se pudo completar la acción. Intenta de nuevo.",
    );
  });

  it("does not treat a history 500 as an empty inbox", async () => {
    mockFetchOnce(500, { error: "relation \"call_history\" does not exist" });

    await expect(
      listHistory({ email: "seb@example.com" }),
    ).rejects.toThrow("No se pudo completar la acción. Intenta de nuevo.");
  });

  it("does not silently stub a failed voice-agent persist", async () => {
    mockFetchOnce(500, { error: 'column "voice_agent" does not exist' });

    await expect(
      saveScenarioVoiceAgent("mariana", DEFAULT_VOICE_AGENT_SETTINGS),
    ).rejects.toThrow("No se pudo completar la acción. Intenta de nuevo.");
  });
});
