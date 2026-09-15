import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { mergeAgenticRuntime } from "@/lib/agentic/runtime";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { clearAllAgenticSessionStates } from "@/lib/agentic/agentic-session-store";

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
});
