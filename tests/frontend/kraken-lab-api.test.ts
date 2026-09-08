import { afterEach, describe, expect, it, vi } from "vitest";
import { startKrakenSession } from "@/lib/api/kraken-lab";
import type { KrakenLabCohortConfig } from "@/lib/kraken-lab/types";
import { generateReceiverPersonas } from "@/lib/kraken-lab/generator";
import { resetStubSessions } from "@/lib/api/stubs";

function sampleCohort(): KrakenLabCohortConfig {
  const cohort: KrakenLabCohortConfig = {
    project: "simulador-llamadas",
    participantCount: 1,
    participants: [
      {
        fullName: "Ana Pasante",
        age: 22,
        city: "Guadalajara",
        simulationCities: ["Monterrey"],
        phone: "3312345678",
        email: "ana@example.com",
      },
    ],
    simulationFocuses: ["ventas"],
    simulatorRole: "caller",
    roleObjective: "Agendar reunión con día y hora",
    dialogueTypes: [
      {
        focus: "ventas",
        simulationContext: "Llamada fría",
        realObjective: "Demo de 15 minutos",
        productServiceExplanation: "Software de inventarios",
      },
    ],
    receiverPersonas: [],
    difficultyLevel: 2,
    sessionSeed: "kraken-api-test-seed",
  };
  cohort.receiverPersonas = generateReceiverPersonas(cohort, 1);
  return cohort;
}

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

describe("Kraken Lab API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetStubSessions();
  });

  it("falls back to the demo stub when POST /api/kraken-lab/sessions returns 500", async () => {
    mockFetchOnce(500, {
      error:
        "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
      code: "schema_outdated",
    });

    const result = await startKrakenSession({
      cohort: sampleCohort(),
      mode: "texto",
    });

    expect(result.callAttemptId).toMatch(/^stub-/);
    expect(result.clientName.length).toBeGreaterThan(0);
    expect(result.totalRounds).toBe(5);
  });

  it("falls back to the demo stub when the sessions route is missing", async () => {
    mockFetchOnce(404, { error: "Not Found" });

    const result = await startKrakenSession({
      cohort: sampleCohort(),
      mode: "voz",
    });

    expect(result.callAttemptId).toMatch(/^stub-/);
    expect(result.config.rounds).toHaveLength(5);
  });

  it("surfaces 400 validation errors instead of silently stubbing", async () => {
    mockFetchOnce(400, {
      error: "Configuración de cohorte incompleta o inválida",
    });

    await expect(
      startKrakenSession({
        cohort: sampleCohort(),
        mode: "texto",
      }),
    ).rejects.toThrow("Configuración de cohorte incompleta o inválida");
  });
});
