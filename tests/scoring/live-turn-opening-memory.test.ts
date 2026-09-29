import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

describe("scoreLiveTurn opening memory", () => {
  it("does not loop the pickup line after trainee introduces on turn 2", async () => {
    const config = buildScenarioConfig({
      industry: "hotel turismo",
      productSold: "llegada de huéspedes",
      clientProblem: "ocupación baja en temporada",
      objections: ["Ya tenemos OTA"],
      winCriteria: "reunión con gerencia",
      temperament: "Prepotente",
      clientName: "Pedro Perez",
    });

    const live = await scoreLiveTurn({
      utterance:
        "Le vuelvo a insistir, soy Jaime Yepes, representante de Logan y traemos huéspedes a su hotel.",
      roundKey: "apertura-2",
      roundLabel: "Objeción",
      roundGoal: config.rounds[1]?.goal ?? "Objeción",
      difficultyLevel: 2,
      scenarioSlug: "pedro-perez-hotel",
      isPreset: false,
      config,
      clientName: "Pedro Perez",
      isLastRound: false,
      roundNumber: 2,
      priorLines: [
        {
          role: "trainee",
          text: "Buenos días, ¿hablo con el gerente?",
        },
      ],
      voiceAgent: {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        clientLayer: {
          ...DEFAULT_VOICE_AGENT_SETTINGS.clientLayer!,
          motorEnabled: false,
        },
      },
    });

    expect(live.clientReply.toLowerCase()).not.toBe(
      "¿quién habla? tengo un minuto.",
    );
    expect(live.clientReply.toLowerCase()).not.toMatch(/^¿quién habla\?/);
  });
});
