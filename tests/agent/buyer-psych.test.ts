import { describe, expect, it } from "vitest";
import {
  analyzeBuyerPsych,
  ASSISTANT_CLOSING,
  BUYER_DEFAULT_TOKEN_BUDGET,
  buildBuyerRoleLock,
  clipBuyerTurn,
  detectSlotOffered,
  enforceBuyerTurnPolicy,
  estimateSpokenTokens,
  resolveBuyerPhase,
} from "@/lib/agent/buyer-psych";
import { applyBuyerTool } from "@/lib/agent/buyer-tools";
import { DATE_DEMAND_AFTER_ACCEPT } from "@/lib/agent/client-motor";

describe("buyer psych harness", () => {
  it("role-locks the customer as a phone buyer, not an assistant", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Buenos días, ¿tiene un minuto?",
      roundNumber: 1,
      scenarioSlug: "mariana",
    });
    const prompt = buildBuyerRoleLock({
      name: "Mariana Escobedo",
      title: "Directora de Mercadotecnia",
      setting: "una caseta de vivienda",
      hiddenGoals: "Solo abre agenda si hay día y hora",
      state,
    });
    expect(prompt).toMatch(/CLIENTE en el teléfono/i);
    expect(prompt).toMatch(/Nunca hables como el vendedor/);
    expect(prompt).toMatch(/PROHIBIDO/);
    expect(prompt).toMatch(/FAIL:.*En qué más te puedo ayudar/i);
    expect(ASSISTANT_CLOSING.test("¿En qué más te puedo ayudar?")).toBe(true);
    expect(
      enforceBuyerTurnPolicy(
        "¿En qué más te puedo ayudar?",
        state,
        "Buenos días, ¿tiene un minuto?",
      ),
    ).not.toMatch(/en qué más te puedo ayudar/i);
  });

  it("forces opening_id → reason_probe → resist → schedule → closing", () => {
    expect(
      resolveBuyerPhase({
        turnNumber: 1,
        subsequentCall: false,
        identitySettled: false,
        reasonHeard: false,
        hasResisted: false,
        slotOffered: false,
        slotResolved: false,
        hardBlock: false,
        presentationAccepted: false,
        longPitch: false,
        resistanceStyle: "stall",
      }),
    ).toBe("opening_id");
    expect(
      resolveBuyerPhase({
        turnNumber: 2,
        subsequentCall: false,
        identitySettled: true,
        reasonHeard: false,
        hasResisted: false,
        slotOffered: false,
        slotResolved: false,
        hardBlock: false,
        presentationAccepted: false,
        longPitch: false,
        resistanceStyle: "stall",
      }),
    ).toBe("reason_probe");
    expect(
      resolveBuyerPhase({
        turnNumber: 3,
        subsequentCall: false,
        identitySettled: true,
        reasonHeard: true,
        hasResisted: false,
        slotOffered: false,
        slotResolved: false,
        hardBlock: false,
        presentationAccepted: false,
        longPitch: false,
        resistanceStyle: "stall",
      }),
    ).toBe("resist");
    expect(
      resolveBuyerPhase({
        turnNumber: 5,
        subsequentCall: false,
        identitySettled: true,
        reasonHeard: true,
        hasResisted: true,
        slotOffered: true,
        slotResolved: false,
        hardBlock: false,
        presentationAccepted: true,
        longPitch: false,
        resistanceStyle: "stall",
      }),
    ).toBe("schedule_or_exit");
    expect(
      resolveBuyerPhase({
        turnNumber: 5,
        subsequentCall: false,
        identitySettled: true,
        reasonHeard: true,
        hasResisted: true,
        slotOffered: true,
        slotResolved: true,
        hardBlock: false,
        presentationAccepted: true,
        longPitch: false,
        resistanceStyle: "stall",
      }),
    ).toBe("closing");
  });

  it("latches a concrete Friday 9am offer and bans the caseta stall", () => {
    const offered = detectSlotOffered(
      [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero de caseta.",
        },
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ],
      "¿Le parece el viernes a las 9 de la mañana?",
    );
    expect(offered).toBe(true);
    expect(detectSlotOffered([], "9 de la mañana")).toBe(false);

    const state = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece el viernes a las 9 de la mañana?",
      priorTurns: [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero de caseta.",
        },
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ],
      roundNumber: 5,
      scenarioSlug: "mariana",
    });
    expect(state.slotOffered).toBe(true);
    expect(state.phase).toBe("schedule_or_exit");
    const repaired = enforceBuyerTurnPolicy(
      "Sin día y hora en mi agenda no hay revisión de caseta.",
      state,
      "¿Le parece el viernes a las 9 de la mañana?",
    );
    expect(repaired).toMatch(/viernes/i);
    expect(repaired).not.toMatch(DATE_DEMAND_AFTER_ACCEPT);
    expect(repaired).not.toMatch(/sin día y hora/i);
  });

  it("does not rewrite a date-demand when no real slot was offered", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Le mando el one-pager del tablero.",
      priorTurns: [
        {
          role: "trainee",
          text: "Podemos hacer una presentación del tablero de caseta.",
        },
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ],
      roundNumber: 5,
      scenarioSlug: "mariana",
    });
    expect(state.slotOffered).toBe(false);
    const kept = enforceBuyerTurnPolicy(
      "Sin día y hora en mi agenda no hay revisión de caseta.",
      state,
      "Le mando el one-pager del tablero.",
    );
    expect(kept).not.toMatch(/Ese horario me sirve/i);
  });

  it("clips default turns to a phone budget", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "Buenos días",
      roundNumber: 1,
      scenarioSlug: "mariana",
    });
    expect(state.tokenBudget).toBe(BUYER_DEFAULT_TOKEN_BUDGET);
    const long =
      "Primera oración larga sobre cómo me encantaría ayudarle a vender mejor. Segunda oración de coaching. Tercera que ya no debería salir.";
    const clipped = clipBuyerTurn(long, state);
    expect(splitCount(clipped)).toBeLessThanOrEqual(2);
    expect(estimateSpokenTokens(clipped)).toBeLessThanOrEqual(
      BUYER_DEFAULT_TOKEN_BUDGET + 2,
    );
  });

  it("runs buyer tools instead of hoping the model remembers the slot", () => {
    const state = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece el viernes a las 9 de la mañana?",
      roundNumber: 4,
      scenarioSlug: "mariana",
    });
    const ack = applyBuyerTool(
      state,
      "acknowledge_slot",
      { day: "viernes", time: "9", stance: "accept" },
      "¿Le parece el viernes a las 9 de la mañana?",
    );
    expect(ack.spoken).toMatch(/viernes/i);
    expect(ack.next.slotResolved).toBe(true);
    const hang = applyBuyerTool(state, "end_call", { reason: "Estoy en junta" });
    expect(hang.spoken).toMatch(/Adiós/);
    expect(hang.next.phase).toBe("closing");
  });
});

function splitCount(text: string): number {
  return text.split(/(?<=[.!?…])\s+/).filter(Boolean).length;
}
