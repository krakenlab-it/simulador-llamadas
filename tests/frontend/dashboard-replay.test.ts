import { describe, expect, it } from "vitest";
import { replaySetupFromDetail } from "@/lib/frontend/replay-setup";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";
import type { SessionDetail } from "@/lib/api/stubs";

function detail(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    callAttemptId: "ca-1",
    traineeId: "tr-1",
    scenarioSlug: "laura-gimnasio",
    clientName: "Laura Méndez",
    isPreset: false,
    difficultyLevel: 2,
    mode: "voz",
    status: "completed",
    won: true,
    totalScore: 80,
    startedAt: "2026-09-02T10:00:00.000Z",
    endedAt: "2026-09-02T10:06:00.000Z",
    durationSeconds: 360,
    turnsCompleted: 5,
    totalRounds: 5,
    evaluation: null,
    turns: [],
    ...overrides,
  };
}

describe("replaySetupFromDetail", () => {
  it("restores authored phases, opening line, and voice knobs from the scored call", () => {
    const setup = replaySetupFromDetail(
      detail({
        voiceAgent: {
          ...DEFAULT_VOICE_AGENT_SETTINGS,
          language: "en",
          personality: "esceptico",
          speakingRate: "lento",
        },
        config: {
          industry: "gimnasio",
          productSold: "membresía",
          clientProblem: "retención",
          objections: [],
          winCriteria: "clase prueba",
          temperament: "Impaciente",
          openingLines: ["Buenas tardes, ¿llamo al gimnasio de Laura?"],
          rounds: [
            {
              key: "apertura",
              label: "Apertura gym",
              goal: "",
              clientPrompt: "¿Quién habla?",
              positiveCriteria: [],
              negativeCriteria: [],
            },
            {
              key: "objecion",
              label: "Precio",
              goal: "",
              clientPrompt: "Está caro",
              positiveCriteria: [],
              negativeCriteria: [],
            },
          ],
          criteria: [],
          globalPositiveCriteria: [],
        },
      }),
    );

    expect(setup.voiceAgent).toEqual(
      expect.objectContaining({
        language: "en",
        personality: "esceptico",
        speakingRate: "lento",
      }),
    );
    expect(setup.phaseLabels[0]).toBe("Apertura gym");
    expect(setup.openingLine).toBe(
      "Buenas tardes, ¿llamo al gimnasio de Laura?",
    );
  });

  it("uses clinic defaults when older details omit voice and config", () => {
    const setup = replaySetupFromDetail(detail({ isPreset: true }));
    expect(setup.voiceAgent).toEqual(DEFAULT_VOICE_AGENT_SETTINGS);
    expect(setup.phaseLabels).toEqual([
      "Apertura",
      "Objeción",
      "Claridad",
      "Correo",
      "Cierre",
    ]);
    expect(setup.openingLine).toBe("¿Quién habla?");
  });
});
