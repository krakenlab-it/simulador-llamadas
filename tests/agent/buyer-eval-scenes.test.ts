import { describe, expect, it } from "vitest";
import {
  analyzeBuyerPsych,
  enforceBuyerTurnPolicy,
  evaluateBuyerBehavior,
} from "@/lib/agent/buyer-psych";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { DATE_DEMAND_AFTER_ACCEPT } from "@/lib/agent/client-motor";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

describe("KAN-95 eval scenes E1–E8", () => {
  it("E1 cold open at the local asks who/where in short turns", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Buenos días, ¿tiene un minuto para una solución integral?",
      roundNumber: 1,
      scenarioSlug: "mariana",
    });
    expect(state.phase).toBe("opening_id");
    const leak = enforceBuyerTurnPolicy(
      "¡Claro! ¿En qué más te puedo ayudar?",
      state,
      "Buenos días, ¿tiene un minuto?",
    );
    expect(leak).toMatch(/quién habla/i);
    expect(leak).not.toMatch(/en qué más/i);
    const pass = evaluateBuyerBehavior({
      replies: [leak],
      state,
      scene: "E1",
    });
    expect(pass.pass).toBe(true);
  });

  it("E2 uses the sin día y hora stall once, then escalates", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Queremos revisar el tablero de visitas al local.",
      roundNumber: 3,
      scenarioSlug: "mariana",
    });
    expect(state.slotOffered).toBe(false);
    const once = evaluateBuyerBehavior({
      replies: ["Sin día y hora fijo todavía. Mándame un WhatsApp."],
      state,
      scene: "E2",
    });
    expect(once.pass).toBe(true);
    const looped = enforceBuyerTurnPolicy(
      "Sin día y hora en mi agenda no hay revisión del local.",
      state,
      "Queremos revisar el tablero.",
      [
        "Sin día y hora en mi agenda no hay revisión del local.",
        "Sin día y hora en mi agenda no hay revisión del local.",
        "Sin día y hora en mi agenda no hay revisión del local.",
      ],
    );
    expect(looped).toMatch(/correo|WhatsApp/i);
    expect(looped).not.toMatch(/sin día y hora/i);
  });

  it("E3 slot latch acknowledges viernes 9am and never amnesia-stalls", async () => {
    const config = buildPresetScenarioConfig("mariana");
    const state = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece el viernes a las 9 de la mañana?",
      priorTurns: [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero del local.",
        },
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ],
      roundNumber: 5,
      scenarioSlug: "mariana",
    });
    expect(state.slotOffered).toBe(true);
    const policed = enforceBuyerTurnPolicy(
      "Sin día y hora en mi agenda no hay revisión del local.",
      state,
      "¿Le parece el viernes a las 9 de la mañana?",
    );
    expect(
      evaluateBuyerBehavior({
        replies: [policed],
        state,
        scene: "E3",
      }).pass,
    ).toBe(true);

    const live = await scoreLiveTurn({
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
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ],
      voiceAgent: {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        clientLayer: { motorEnabled: true, toneId: "auto" },
      },
    });
    expect(live.clientReply).toMatch(/viernes/i);
    expect(live.clientReply).not.toMatch(DATE_DEMAND_AFTER_ACCEPT);
  });

  it("E4 hard block moves Rodrigo to close instead of coaching features", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance:
        "Somos líderes en branding nacional y le cuento todo el portafolio de awareness.",
      priorTurns: [
        { role: "trainee", text: "Le llamo por las aperturas de proximidad." },
        { role: "client", text: "Ya tenemos proveedor. Si es branding, cuelgo." },
      ],
      roundNumber: 2,
      scenarioSlug: "rodrigo",
    });
    expect(state.resistanceStyle).toBe("block");
    expect(state.phase).toBe("closing");
    const line = enforceBuyerTurnPolicy(
      "Ya tenemos proveedor. Cuelgo.",
      state,
      "Somos líderes en branding.",
    );
    expect(
      evaluateBuyerBehavior({
        replies: [line],
        state,
        scene: "E4",
      }).pass,
    ).toBe(true);
  });

  it("E5 polite exit thanks and stops interviewing", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece si seguimos con más preguntas de descubrimiento?",
      priorTurns: [
        { role: "trainee", text: "¿Le parece el jueves a las 10 para el tablero?" },
        { role: "client", text: "Listo, quedamos. Ese horario me sirve." },
      ],
      roundNumber: 5,
      scenarioSlug: "mariana",
    });
    expect(state.phase).toBe("closing");
    const line = enforceBuyerTurnPolicy(
      "Gracias, qué amable. Adiós.",
      state,
      "¿Le parece si seguimos?",
    );
    expect(line).not.toMatch(/\?/);
    expect(
      evaluateBuyerBehavior({ replies: [line], state, scene: "E5" }).pass,
    ).toBe(true);
  });

  it("E6 gatekeeper does not book alone", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Entonces quedamos el lunes a las 8:15, ¿va?",
      roundNumber: 3,
      scenarioSlug: "efrain",
      pack: {
        decisionRole: "guardian",
        encounterType: "fria",
        temperament: "Directo, desconfía de clics",
      },
    });
    expect(state.gatekeeper).toBe(true);
    const line = enforceBuyerTurnPolicy(
      "Quedamos el lunes. Nos vemos.",
      state,
      "Entonces quedamos el lunes a las 8:15, ¿va?",
    );
    expect(line).toMatch(/correo|decide/i);
    expect(line).not.toMatch(/Quedamos el lunes/i);
    expect(
      evaluateBuyerBehavior({ replies: [line], state, scene: "E6" }).pass,
    ).toBe(true);
  });

  it("E7 interrupts a long pitch instead of coaching through it", () => {
    const pitch =
      "Somos la mejor agencia y líderes en soluciones integrales de atribución. Le cuento todo el portafolio sin preguntarle nada: branding, pauta, retainer, workshops y casos de éxito. Después le explico por qué deberían firmar hoy mismo sin revisar su local ni su CAC ni su agenda de esta semana.";
    const state = analyzeBuyerPsych({
      traineeUtterance: pitch,
      priorTurns: [
        { role: "trainee", text: "Le llamo por las visitas al local." },
        { role: "client", text: "Este… a ver." },
      ],
      roundNumber: 2,
      scenarioSlug: "mariana",
    });
    expect(state.longPitch).toBe(true);
    const line = enforceBuyerTurnPolicy(
      "Espéreme. ¿Quién les dio mi número?",
      state,
      pitch,
    );
    expect(
      evaluateBuyerBehavior({ replies: [line], state, scene: "E7" }).pass,
    ).toBe(true);
  });

  it("E8 warm subsequent skips cold quién habla", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Te marco de nuevo por la revisión del tablero.",
      priorTurns: [
        { role: "trainee", text: "Como hablamos la semana pasada del tablero." },
        { role: "client", text: "Sí, me acuerdo. Estoy a las carreras." },
      ],
      roundNumber: 1,
      scenarioSlug: "mariana",
      pack: {
        decisionRole: "decisor",
        encounterType: "seguimiento",
        temperament: "Escéptica, entre juntas",
      },
    });
    expect(state.subsequentCall).toBe(true);
    expect(state.phase).not.toBe("opening_id");
    const line = enforceBuyerTurnPolicy(
      "Mira, sigo sin hueco. Mándame el one-pager.",
      state,
      "Te marco de nuevo por la revisión del tablero.",
    );
    expect(line).not.toMatch(/quién habla/i);
    expect(
      evaluateBuyerBehavior({ replies: [line], state, scene: "E8" }).pass,
    ).toBe(true);
  });
});
