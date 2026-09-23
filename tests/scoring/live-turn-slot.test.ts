import { describe, expect, it } from "vitest";
import { DATE_DEMAND_AFTER_ACCEPT } from "@/lib/agent/client-motor";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import {
  utteranceHasConcreteDayAndTime,
  utteranceHasDay,
  utteranceHasTime,
} from "@/lib/scoring/keywords";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

describe("live turn: accept presentation then offer datetime", () => {
  it("detects viernes a las 9 de la mañana as a concrete slot", () => {
    expect(
      utteranceHasConcreteDayAndTime("viernes a las 9 de la mañana"),
    ).toBe(true);
    expect(
      utteranceHasConcreteDayAndTime("¿Le parece el viernes a las 9 de la mañana?"),
    ).toBe(true);
    expect(utteranceHasTime("9 de la mañana")).toBe(true);
    expect(utteranceHasDay("9 de la mañana")).toBe(false);
    expect(utteranceHasConcreteDayAndTime("9 de la mañana")).toBe(false);
    expect(utteranceHasDay("9 de enero")).toBe(true);
  });

  it("does not re-demand local day/time after presentation accept + Friday 9am", async () => {
    const config = buildPresetScenarioConfig("mariana");
    const result = await scoreLiveTurn({
      utterance: "¿Le parece el viernes a las 9 de la mañana?",
      roundKey: "cierre",
      roundType: "cierre",
      roundLabel: "Cierre",
      roundGoal: "Día y hora",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config,
      clientName: "Mariana Escobedo",
      isLastRound: true,
      roundNumber: 5,
      priorLines: [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero de visitas al local.",
        },
        {
          role: "client",
          text: "Sí, adelante, pueden presentar.",
        },
      ],
      voiceAgent: {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        clientLayer: { motorEnabled: true, toneId: "auto" },
      },
    });

    expect(result.clientReaction).toBe("bien");
    expect(result.clientReply).toMatch(/viernes/i);
    expect(result.clientReply).toMatch(/local|tablero|invitaci/i);
    expect(result.clientReply).not.toMatch(DATE_DEMAND_AFTER_ACCEPT);
    expect(result.clientReply).not.toMatch(
      /Sin día y hora en mi agenda no hay revisión del local/i,
    );
  });

  it("does not fake a slot acknowledgment when only the presentation was accepted", async () => {
    const config = buildPresetScenarioConfig("mariana");
    const result = await scoreLiveTurn({
      utterance: "Le mando el one-pager del tablero.",
      roundKey: "cierre",
      roundType: "cierre",
      roundLabel: "Cierre",
      roundGoal: "Día y hora",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config,
      clientName: "Mariana Escobedo",
      isLastRound: true,
      roundNumber: 5,
      priorLines: [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero de visitas al local.",
        },
        {
          role: "client",
          text: "Sí, adelante, pueden presentar.",
        },
      ],
      voiceAgent: {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        clientLayer: { motorEnabled: true, toneId: "auto" },
      },
    });

    expect(result.clientReply).not.toMatch(/Ese horario me sirve/i);
    expect(result.clientReply).not.toMatch(/^Viernes\b/i);
    expect(result.clientReply).not.toMatch(/Queda\. Envíeme la invitación/i);
  });
});
