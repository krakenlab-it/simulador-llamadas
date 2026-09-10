import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  createScenario,
  listHistory,
  loadHistory,
  listScenarios,
  loadScenarioCatalog,
  saveScenarioVoiceAgent,
  submitTurn,
} from "@/lib/api/client";
import { resetStubSessions } from "@/lib/api/stubs";
import { appendLocalHistory, clearLocalHistory } from "@/lib/history/local";
import { clearLocalCustomScenarios } from "@/lib/scenarios/local";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

const sampleCreateInput = {
  industry: "gimnasio",
  productSold: "membresía anual",
  clientName: "Laura Méndez",
  clientTitle: "Gerente",
  companyContext: "Cadena de gimnasios",
  temperament: "Impaciente",
  difficultyLabel: "Media",
  clientProblem: "baja retención de socios",
  objections: ["Muy caro"],
  winCriteria: "SPIN Advance: visita con acción concreta",
};

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
    resetStubSessions();
    clearLocalHistory();
    clearLocalCustomScenarios();
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

  it("falls back to a stub session when POST /api/sessions returns 500", async () => {
    mockFetchOnce(500, {
      error:
        "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
      code: "schema_outdated",
    });

    const session = await createSession({
      scenarioSlug: "mariana",
      mode: "texto",
      difficultyLevel: 1,
    });

    expect(session.scenarioSlug).toBe("mariana");
    expect(session.callAttemptId).toBeTruthy();
    expect(session.status).toBe("in_progress");
  });

  it("falls back to clinic stub presets when GET /api/scenarios returns 500", async () => {
    mockFetchOnce(500, { error: 'column "voice_agent" does not exist' });

    const scenarios = await listScenarios();

    expect(scenarios.some((s) => s.slug === "mariana")).toBe(true);
    expect(scenarios.filter((s) => s.isPreset)).toHaveLength(3);
  });

  it("marks loadScenarioCatalog as local fallback when the API returns 500", async () => {
    mockFetchOnce(500, { error: "relation \"scenarios\" does not exist" });

    const catalog = await loadScenarioCatalog();

    expect(catalog.usedLocalFallback).toBe(true);
    expect(catalog.scenarios.filter((s) => s.isPreset)).toHaveLength(3);
  });

  it("falls back to local history when GET /api/history returns 500", async () => {
    appendLocalHistory({
      callAttemptId: "ca-local-1",
      scenarioSlug: "mariana",
      clientName: "Mariana Escobedo",
      difficultyLevel: 1,
      mode: "texto",
      won: true,
      totalScore: 71,
      turnsCompleted: 5,
      startedAt: "2026-09-01T10:00:00.000Z",
      durationSeconds: 90,
    });

    mockFetchOnce(500, { error: "relation \"call_history\" does not exist" });

    const result = await loadHistory({ email: "seb@example.com" });

    expect(result.usedLocalFallback).toBe(true);
    expect(result.entries.some((e) => e.callAttemptId === "ca-local-1")).toBe(true);
    expect(result.entries[0].clientName).toBe("Mariana Escobedo");
  });

  it("returns empty history without throwing when GET /api/history returns 500 and local is empty", async () => {
    mockFetchOnce(500, { error: "relation \"call_history\" does not exist" });

    const result = await loadHistory({ email: "seb@example.com" });

    expect(result.usedLocalFallback).toBe(true);
    expect(result.entries).toHaveLength(0);
    expect(await listHistory({ email: "seb@example.com" })).toHaveLength(0);
  });

  it("falls back to stub when POST /api/scenarios returns 500", async () => {
    mockFetchOnce(500, { error: "No se pudo crear el escenario." });

    const result = await createScenario({ ...sampleCreateInput });

    expect(result.usedLocalFallback).toBe(true);
    expect(result.scenario.clientName).toBe("Laura Méndez");
    expect(result.scenario.isPreset).toBe(false);
    expect(
      (await loadScenarioCatalog()).scenarios.some(
        (scenario) => scenario.slug === result.scenario.slug,
      ),
    ).toBe(true);
  });

  it("surfaces validation errors when POST /api/scenarios returns 400", async () => {
    mockFetchOnce(400, { error: "Falta el nombre del cliente." });

    await expect(createScenario({ ...sampleCreateInput })).rejects.toThrow(
      "Falta el nombre del cliente.",
    );
  });

  it("falls back to stub voice-agent settings when PATCH returns 500", async () => {
    mockFetchOnce(500, { error: 'column "voice_agent" does not exist' });

    const result = await saveScenarioVoiceAgent(
      "mariana",
      DEFAULT_VOICE_AGENT_SETTINGS,
    );

    expect(result.usedLocalFallback).toBe(true);
    expect(result.scenario.slug).toBe("mariana");
  });
});
