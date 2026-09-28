import { describe, expect, it } from "vitest";
import { analyzeBuyerPsych } from "@/lib/agent/buyer-psych";
import { analyzeMeetingLogistics } from "@/lib/agent/client-motor";
import {
  buildBuyerHarnessContextBlocks,
  buildDialogueTranscriptBlock,
  buildImpersonationChatMessages,
  buildPhaseAdvanceHarnessBlock,
  buildRollingContextSummary,
  enforceHarnessNoRepeat,
  isHardRepeatViolation,
  pickNonRepeatingFallback,
} from "@/lib/agent/dialogue-memory";

describe("dialogue-memory harness (KAN-103)", () => {
  it("builds a rolling summary with phase state and a verbatim window", () => {
    const priorTurns = [
      { role: "trainee" as const, text: "Buenos días." },
      { role: "client" as const, text: "¿Quién habla?" },
      { role: "trainee" as const, text: "Le llamo por el tablero." },
      { role: "client" as const, text: "Mándeme un correo." },
      { role: "trainee" as const, text: "¿Podemos agendar el jueves?" },
      { role: "client" as const, text: "Revíselo con mi asistente." },
      { role: "trainee" as const, text: "¿Y el viernes a las 9?" },
      { role: "client" as const, text: "Puede ser el viernes." },
      { role: "trainee" as const, text: "Le mando la invitación." },
      { role: "client" as const, text: "Al correo que ya tiene." },
    ];
    const psych = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece el viernes a las 9?",
      priorTurns,
      roundNumber: 8,
      scenarioSlug: "mariana",
    });
    const logistics = analyzeMeetingLogistics(priorTurns, "¿Le parece el viernes a las 9?");
    const summary = buildRollingContextSummary({
      priorTurns,
      psych,
      logistics,
      roundNumber: 8,
    });
    expect(summary).toMatch(/RESUMEN RODANTE/);
    expect(summary).toMatch(/fase comprador/);
    expect(summary).toMatch(/Ventana reciente/);
    expect(summary).toMatch(/invitación|viernes/i);
  });

  it("closes early beats so opening is not re-litigated", () => {
    const psych = analyzeBuyerPsych({
      traineeUtterance: "¿Le parece el jueves a las 10?",
      priorTurns: [
        { role: "trainee", text: "Soy Ana de Kraken." },
        { role: "client", text: "Dígame." },
        { role: "trainee", text: "Es por el tablero del local." },
        { role: "client", text: "Ya tenemos agencia." },
      ],
      roundNumber: 5,
      scenarioSlug: "mariana",
    });
    const block = buildPhaseAdvanceHarnessBlock(
      psych,
      analyzeMeetingLogistics(
        [
          { role: "trainee", text: "Soy Ana de Kraken." },
          { role: "client", text: "Dígame." },
        ],
        "¿Le parece el jueves a las 10?",
      ),
    );
    expect(block).toMatch(/AVANCE DE FASE/);
    expect(block).toMatch(/CERRADA/);
    expect(block).toMatch(/no vuelvas a/i);
  });

  it("formats a rolling transcript window", () => {
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
    expect(block).toMatch(/Ventana reciente/);
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
    expect(messages[2].content).toMatch(/minuto/);
  });

  it("flags hard repeats against the last cliente echoes", () => {
    const prior = "Sin día y hora en mi agenda no hay revisión del local.";
    expect(
      isHardRepeatViolation(
        "Sin día y hora en mi agenda no hay revisión del local.",
        [prior],
      ),
    ).toBe(true);
    expect(
      isHardRepeatViolation("Viernes a las 9. Traiga el tablero.", [prior]),
    ).toBe(false);
  });

  it("includes anti-echo block in harness context", () => {
    const psych = analyzeBuyerPsych({
      traineeUtterance: "Seguimos con la agenda",
      priorTurns: [
        { role: "client", text: "Línea A" },
        { role: "client", text: "Línea B" },
      ],
      roundNumber: 4,
    });
    const block = buildBuyerHarnessContextBlocks({
      priorTurns: [{ role: "trainee", text: "Hola" }],
      recentClientReplies: ["Línea A", "Línea B"],
      psych,
      logistics: analyzeMeetingLogistics([], "Seguimos"),
      roundNumber: 4,
    });
    expect(block).toMatch(/ANTI-ECO/);
    expect(block).toMatch(/Línea B/);
  });

  it("replaces a repeat with a phase fallback", () => {
    const line = enforceHarnessNoRepeat({
      candidate: "Ya tenemos proveedor. No busco otra cosa.",
      recentClientReplies: ["Ya tenemos proveedor. No busco otra cosa."],
      phase: "resist",
      primaryFallback: "Ya tenemos proveedor. No busco otra cosa.",
      turnNumber: 7,
    });
    expect(line).not.toBe("Ya tenemos proveedor. No busco otra cosa.");
    expect(pickNonRepeatingFallback({
      phase: "resist",
      recentReplies: ["Ya tenemos proveedor. No busco otra cosa."],
      primaryFallback: "Ya tenemos proveedor. No busco otra cosa.",
      turnNumber: 7,
    })).toBe(line);
  });
});
