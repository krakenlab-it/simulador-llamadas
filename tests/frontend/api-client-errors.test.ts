import { afterEach, describe, expect, it, vi } from "vitest";
import { submitTurn } from "@/lib/api/client";

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
});
