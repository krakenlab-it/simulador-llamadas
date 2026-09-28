import { describe, expect, it } from "vitest";
import {
  buildBuyerChatMessages,
  isNearDuplicateReply,
  withCallOpeningInTranscript,
} from "@/lib/agent/buyer-transcript";
import {
  analyzeBuyerPsych,
  enforceBuyerTurnPolicy,
} from "@/lib/agent/buyer-psych";

describe("buyer transcript memory", () => {
  it("prepends call opening when missing from prior lines", () => {
    const lines = withCallOpeningInTranscript(
      [{ role: "trainee", text: "Soy Jaime de Logan." }],
      "¿Quién habla? Tengo un minuto.",
    );
    expect(lines[0]).toEqual({
      role: "client",
      text: "¿Quién habla? Tengo un minuto.",
    });
    expect(lines[1]?.role).toBe("trainee");
  });

  it("builds multi-turn chat messages for the buyer model", () => {
    const messages = buildBuyerChatMessages(
      [
        { role: "client", text: "¿Quién habla?" },
        { role: "trainee", text: "Soy Jaime, Logan." },
      ],
      "Le vuelvo a insistir, representante de Logan.",
    );
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: "user",
      content: "Le vuelvo a insistir, representante de Logan.",
    });
  });

  it("blocks repeating the opening after the trainee introduced themselves", () => {
    const psych = analyzeBuyerPsych({
      traineeUtterance:
        "Le vuelvo a insistir soy Jaime Yepes representante de Logan",
      priorTurns: [
        { role: "client", text: "¿Quién habla? Tengo un minuto." },
        { role: "trainee", text: "Soy Jaime de Logan." },
      ],
      roundNumber: 3,
    });
    const policed = enforceBuyerTurnPolicy(
      "¿Quién habla? Tengo un minuto.",
      psych,
      "Le vuelvo a insistir soy Jaime Yepes representante de Logan",
      ["¿Quién habla? Tengo un minuto."],
    );
    expect(policed.toLowerCase()).not.toMatch(/quién habla/);
  });

  it("detects near-duplicate client lines", () => {
    const opening = "¿Quién habla? Tengo un minuto.";
    expect(isNearDuplicateReply(opening, [opening])).toBe(true);
    expect(
      isNearDuplicateReply("Ya escuché. Sea concreto.", [opening]),
    ).toBe(false);
  });
});
