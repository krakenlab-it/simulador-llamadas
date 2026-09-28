import { describe, expect, it } from "vitest";
import {
  buildDialogueTranscriptBlock,
  buildImpersonationChatMessages,
  pickNonRepeatingFallback,
  resolveLiveSessionMaxTurns,
} from "@/lib/agent/dialogue-memory";

describe("dialogue-memory", () => {
  it("extends the live turn budget beyond authored phase count", () => {
    expect(resolveLiveSessionMaxTurns(5, 3)).toBe(10);
    expect(resolveLiveSessionMaxTurns(5, 8)).toBe(10);
    expect(resolveLiveSessionMaxTurns(7, 9)).toBe(10);
  });

  it("formats a rolling transcript for long calls", () => {
    const block = buildDialogueTranscriptBlock(
      [
        { role: "trainee", text: "Buenos días." },
        { role: "client", text: "¿Quién habla?" },
        { role: "trainee", text: "Le llamo por el tablero." },
        { role: "client", text: "Mándeme un correo." },
        { role: "trainee", text: "¿Podemos agendar el jueves?" },
        { role: "client", text: "Revíselo con mi asistente." },
      ],
      2,
    );
    expect(block).toMatch(/Transcript reciente/);
    expect(block).toMatch(/tablero/);
    expect(block).not.toMatch(/Buenos días/);
  });

  it("builds multi-turn chat messages for the buyer model", () => {
    const messages = buildImpersonationChatMessages({
      priorTurns: [
        { role: "trainee", text: "Hola" },
        { role: "client", text: "Dígame" },
      ],
      traineeUtterance: "¿Tiene un minuto?",
    });
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].content).toMatch(/minuto/);
  });

  it("picks a fallback that is not identical to recent client lines", () => {
    const line = pickNonRepeatingFallback({
      phase: "resist",
      recentReplies: ["Ya tenemos proveedor. No busco otra cosa."],
      primaryFallback: "Ya tenemos proveedor. No busco otra cosa.",
      turnNumber: 7,
    });
    expect(line).not.toBe("Ya tenemos proveedor. No busco otra cosa.");
    expect(line.length).toBeGreaterThan(8);
  });
});
