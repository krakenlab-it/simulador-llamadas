import { describe, expect, it } from "vitest";
import { analyzeBuyerPsych } from "@/lib/agent/buyer-psych";
import { analyzeMeetingLogistics } from "@/lib/agent/client-motor";
import {
  buildBuyerHarnessContextBlocks,
  buildImpersonationChatMessages,
  buildPhaseAdvanceHarnessBlock,
  buildRollingContextSummary,
  enforceHarnessNoRepeat,
  isHardRepeatViolation,
  LIVE_DIALOGUE_PAIR_LIMIT,
  reopensClosedBeat,
} from "@/lib/agent/dialogue-memory";

function psychAt(roundNumber: number, priorTurns: { role: "trainee" | "client"; text: string }[], utterance: string) {
  return analyzeBuyerPsych({
    traineeUtterance: utterance,
    priorTurns,
    roundNumber,
    scenarioSlug: "mariana",
  });
}

describe("dialogue-memory harness (KAN-103)", () => {
  const priorTurns = [
    { role: "trainee" as const, text: "Buenos días, soy Ana de Kraken." },
    { role: "client" as const, text: "¿Quién habla?" },
    { role: "trainee" as const, text: "Le llamo por el tablero del local." },
    { role: "client" as const, text: "Ya tenemos agencia." },
    { role: "trainee" as const, text: "¿Podemos agendar el jueves a las 10?" },
    { role: "client" as const, text: "Mándeme un correo." },
    { role: "trainee" as const, text: "¿Y el viernes a las 9?" },
    { role: "client" as const, text: "Puede ser el viernes." },
    { role: "trainee" as const, text: "Le mando la invitación al correo." },
    { role: "client" as const, text: "Al correo que ya tiene." },
  ];

  it("summarizes state instead of pasting the whole transcript", () => {
    const psych = psychAt(8, priorTurns, "¿Confirmamos el viernes a las 9?");
    const summary = buildRollingContextSummary({
      priorTurns,
      psych,
      logistics: analyzeMeetingLogistics(priorTurns, "¿Confirmamos el viernes a las 9?"),
      roundNumber: 8,
    });
    expect(summary).toMatch(/RESUMEN RODANTE/);
    expect(summary).toMatch(/fase: /);
    expect(summary).toMatch(/Tu última postura/);
    expect(summary).not.toMatch(/Ventana reciente/);
    expect(summary).not.toMatch(/Buenos días, soy Ana/);
  });

  it("closes early beats and names the next legal move", () => {
    const turns = priorTurns.slice(0, 4);
    const psych = psychAt(5, turns, "¿Le parece el jueves a las 10?");
    const block = buildPhaseAdvanceHarnessBlock(
      psych,
      analyzeMeetingLogistics(turns, "¿Le parece el jueves a las 10?"),
    );
    expect(block).toMatch(/AVANCE DE FASE/);
    expect(block).toMatch(/CERRADA/);
    expect(block).toMatch(/Ahora:/);
  });

  it("keeps only the recent pairs in the model chat tail", () => {
    const messages = buildImpersonationChatMessages({
      priorTurns,
      traineeUtterance: "¿Quedamos entonces?",
    });
    expect(messages.length).toBeLessThanOrEqual(LIVE_DIALOGUE_PAIR_LIMIT * 2);
    expect(messages.at(-1)?.content).toMatch(/Quedamos/);
    expect(messages.map((message) => message.content).join("\n")).not.toMatch(/soy Ana/);
  });

  it("flags exact repeats from anywhere in the call and paraphrases in the echo window", () => {
    const stall = "Sin día y hora en mi agenda no hay revisión del local.";
    const paraphrase = "En mi agenda, sin día y hora, no hay revisión del local.";
    expect(isHardRepeatViolation(stall, [stall, "Otra cosa.", "Sigo.", "Listo."])).toBe(
      true,
    );
    expect(isHardRepeatViolation(paraphrase, [stall])).toBe(true);
    expect(
      isHardRepeatViolation("Viernes a las 9. Traiga el tablero del local.", [stall]),
    ).toBe(false);
  });

  it("rejects reopening quién habla after identity is settled", () => {
    const psych = psychAt(6, priorTurns.slice(0, 4), "Seguimos con la agenda.");
    expect(psych.identitySettled).toBe(true);
    expect(psych.phase).not.toBe("opening_id");
    expect(reopensClosedBeat("Este… ¿quién habla otra vez?", psych)).toBe(true);
    const line = enforceHarnessNoRepeat({
      candidate: "Este… ¿quién habla otra vez?",
      recentClientReplies: ["Ya tenemos agencia."],
      psych,
      primaryFallback: "Este… ¿quién habla otra vez?",
      turnNumber: 6,
    });
    expect(line).not.toMatch(/quién habla/i);
    expect(isHardRepeatViolation(line, ["Ya tenemos agencia."])).toBe(false);
  });

  it("includes anti-echo of the last cliente lines", () => {
    const psych = psychAt(4, [{ role: "trainee", text: "Hola" }], "Seguimos");
    const block = buildBuyerHarnessContextBlocks({
      priorTurns: [{ role: "trainee", text: "Hola" }],
      recentClientReplies: ["Línea A", "Línea B", "Línea C", "Línea D", "Línea E"],
      psych,
      logistics: analyzeMeetingLogistics([], "Seguimos"),
      roundNumber: 4,
    });
    expect(block).toMatch(/ANTI-ECO/);
    expect(block).toMatch(/Línea E/);
    expect(block).not.toMatch(/Línea A/);
  });

  it("keeps a fresh slot acknowledgment when the draft repeats a stall", () => {
    const stall = "Sin día y hora en mi agenda no hay revisión del local.";
    const psych = {
      ...psychAt(6, priorTurns.slice(0, 4), "¿Le parece el viernes a las 9?"),
      slotOffered: true,
      offeredSlot: "el viernes a las 9",
    };
    const line = enforceHarnessNoRepeat({
      candidate: stall,
      recentClientReplies: [stall],
      psych,
      primaryFallback: "Viernes a las 9. Traiga el tablero del local.",
      turnNumber: 6,
    });
    expect(line).toMatch(/viernes/i);
    expect(line).not.toMatch(/sin día y hora/i);
  });

  it("does not fall back to the same stuck line", () => {
    const stuck = "Ya tenemos proveedor. No busco otra cosa.";
    const psych = psychAt(7, priorTurns.slice(0, 4), "¿Y si vemos el tablero?");
    const line = enforceHarnessNoRepeat({
      candidate: stuck,
      recentClientReplies: [stuck],
      psych,
      primaryFallback: stuck,
      turnNumber: 7,
    });
    expect(line).not.toBe(stuck);
    expect(isHardRepeatViolation(line, [stuck]) || reopensClosedBeat(line, psych)).toBe(
      false,
    );
  });
});
