import { describe, expect, it, vi } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { mergeAgenticRuntime } from "@/lib/agentic/runtime";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { clearAllAgenticSessionStates } from "@/lib/agentic/agentic-session-store";

const generateCharacterReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agentic/character-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agentic/character-runtime")>();
  return {
    ...actual,
    generateCharacterReply: generateCharacterReply,
  };
});

describe("agentic live turn /reiniciar", () => {
  it("resets transcript context and returns a fresh opening line", async () => {
    const base = buildScenarioConfig({
      industry: "Logística",
      productSold: "WMS cloud",
      clientProblem: "Errores de picking",
      objections: ["Integración compleja"],
      winCriteria: "Piloto de 30 días",
      temperament: "Directo",
      clientName: "Carlos",
    });

    const config = mergeAgenticRuntime(base, {
      enabled: true,
      toneId: "desconfianza",
      sessionSeed: "restart-seed",
    });

    const priorLines = [
      { role: "client" as const, text: "¿Quién habla?" },
      { role: "trainee" as const, text: "Buenos días, le llamo por picking." },
      { role: "client" as const, text: "No tengo tiempo." },
    ];

    const restarted = await scoreLiveTurn({
      utterance: "/reiniciar",
      roundKey: "apertura-2",
      roundLabel: "Apertura",
      roundGoal: config.rounds[0].goal,
      difficultyLevel: 2,
      scenarioSlug: "custom-logistics",
      isPreset: false,
      config,
      clientName: "Carlos",
      isLastRound: false,
      roundNumber: 2,
      sessionSeed: "restart-seed",
      priorLines,
      agenticPersistence: {
        state: {
          callAttemptId: "restart-seed",
          mode: "cliente",
          meters: { confianza: 3, interes: 3, paciencia: 6 },
          turnNumber: 1,
        },
        transcriptOffset: 0,
      },
    });

    expect(restarted.clientReply.length).toBeGreaterThan(3);
    expect(restarted.clientReply).not.toContain("No tengo tiempo");
    expect(restarted.agenticPersistence?.transcriptOffset).toBe(priorLines.length);
    expect(restarted.agenticPersistence?.state.turnNumber).toBe(0);
    clearAllAgenticSessionStates();
  });

  it("uses agentic turn budget after restart instead of the DB round number", async () => {
    generateCharacterReply.mockResolvedValue({
      reply: "¿Dígame?",
      evaluatorMode: false,
    });

    const base = buildScenarioConfig({
      industry: "Logística",
      productSold: "WMS cloud",
      clientProblem: "Errores de picking",
      objections: ["Integración compleja"],
      winCriteria: "Piloto de 30 días",
      temperament: "Directo",
      clientName: "Carlos",
    });

    const config = mergeAgenticRuntime(base, {
      enabled: true,
      toneId: "desconfianza",
      sessionSeed: "restart-budget",
    });

    const offset = 3;
    const priorLines = [
      { role: "client" as const, text: "¿Quién habla?" },
      { role: "trainee" as const, text: "Buenos días." },
      { role: "client" as const, text: "No tengo tiempo." },
    ];

    await scoreLiveTurn({
      utterance: "Hola de nuevo, ¿tiene un minuto?",
      roundKey: "apertura-9",
      roundLabel: "Apertura",
      roundGoal: config.rounds[0].goal,
      difficultyLevel: 2,
      scenarioSlug: "custom-logistics",
      isPreset: false,
      config,
      clientName: "Carlos",
      isLastRound: false,
      roundNumber: 9,
      sessionSeed: "restart-budget",
      priorLines,
      agenticPersistence: {
        state: {
          callAttemptId: "restart-budget",
          mode: "cliente",
          meters: { confianza: 5, interes: 5, paciencia: 8 },
          turnNumber: 0,
        },
        transcriptOffset: offset,
      },
    });

    expect(generateCharacterReply).toHaveBeenCalled();
    const call = generateCharacterReply.mock.calls.at(-1)?.[0];
    expect(call?.turnNumber).toBe(1);
    expect(call?.isCallEnding).toBe(false);

    generateCharacterReply.mockReset();
    clearAllAgenticSessionStates();
  });
});
