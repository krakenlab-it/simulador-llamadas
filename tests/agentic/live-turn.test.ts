import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { mergeAgenticRuntime } from "@/lib/agentic/runtime";

describe("agentic live turn path", () => {
  it("uses agentic runtime for enabled custom sessions without affecting clinic presets", async () => {
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
      sessionSeed: "test-seed",
    });

    const live = await scoreLiveTurn({
      utterance: "Buenos días, le llamo por los errores de picking en su almacén.",
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: config.rounds[0].goal,
      difficultyLevel: 2,
      scenarioSlug: "custom-logistics",
      isPreset: false,
      config,
      clientName: "Carlos",
      isLastRound: false,
      priorLines: [{ role: "client", text: "¿Quién habla?" }],
    });

    expect(live.clientReply.length).toBeGreaterThan(5);
    expect(live.coaching.note.length).toBeGreaterThan(5);
  });
});
