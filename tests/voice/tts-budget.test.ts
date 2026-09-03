import { describe, expect, it } from "vitest";
import {
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_TTS_MAX_CHARS_PER_TURN,
} from "@/lib/voice/brakes";
import {
  isSpeakableTtsText,
  sessionExtraTtsRemainingChars,
  truncateForBilledTts,
} from "@/lib/voice/tts-budget";
import { checkSessionExtraTtsBudget } from "@/lib/voice/usage";

describe("billed TTS spend brakes", () => {
  it("caps extra TTS per session at paid-plan demo defaults, not unlimited", () => {
    expect(SESSION_EXTRA_TTS_MAX_CHARS).toBe(4000);
    expect(SESSION_TTS_MAX_CHARS_PER_TURN).toBe(480);
  });

  it("refuses session extra TTS over the cap with browser fallback", async () => {
    const usage = {
      id: "usage-1",
      verifiedUserId: "user-1",
      convaiSecondsUsed: 0,
      traineeAudioSecondsUsed: 0,
      extraTtsCharsUsed: SESSION_EXTRA_TTS_MAX_CHARS - 50,
      convaiSlotHeld: false,
    };

    const within = await checkSessionExtraTtsBudget(usage, 50);
    expect(within.allowed).toBe(true);

    const over = await checkSessionExtraTtsBudget(usage, 51);
    expect(over.allowed).toBe(false);
    expect(over.reason).toBe("session_extra_tts_limit");
    expect(over.fallbackToBrowser).toBe(true);
  });

  it("reports remaining session extra TTS chars", () => {
    const usage = {
      id: "usage-1",
      verifiedUserId: "user-1",
      convaiSecondsUsed: 0,
      traineeAudioSecondsUsed: 0,
      extraTtsCharsUsed: 120,
      convaiSlotHeld: false,
    };
    expect(sessionExtraTtsRemainingChars(usage)).toBe(
      SESSION_EXTRA_TTS_MAX_CHARS - 120,
    );
  });
});

describe("truncateForBilledTts", () => {
  it("passes short patient lines through unchanged", () => {
    const line = "Hola, soy Mariana. ¿Quién habla?";
    expect(truncateForBilledTts(line)).toEqual({
      requestedChars: line.length,
      spokenText: line,
      sentChars: line.length,
    });
  });

  it("truncates a rambling reply before ElevenLabs billing", () => {
    const chunk =
      "Mire, yo entiendo lo que dice, pero en la clínica ya tenemos muchos proveedores " +
      "y la verdad es que no veo cómo esto me ayuda con las citas de la tarde ni con el personal " +
      "que ya está saturado atendiendo pacientes en recepción y en consultorio todos los días. ";
    let long = "";
    while (long.length <= SESSION_TTS_MAX_CHARS_PER_TURN) long += chunk;

    const result = truncateForBilledTts(long);
    expect(result.requestedChars).toBe(long.length);
    expect(result.sentChars).toBeLessThanOrEqual(SESSION_TTS_MAX_CHARS_PER_TURN);
    expect(result.spokenText.length).toBe(result.sentChars);
    expect(long.startsWith(result.spokenText.slice(0, 20))).toBe(true);
  });
});

describe("isSpeakableTtsText", () => {
  it("rejects empty strings and punctuation-only UI noise", () => {
    expect(isSpeakableTtsText("")).toBe(false);
    expect(isSpeakableTtsText("   ")).toBe(false);
    expect(isSpeakableTtsText("...")).toBe(false);
    expect(isSpeakableTtsText("!!!")).toBe(false);
  });

  it("accepts short Spanish patient lines", () => {
    expect(isSpeakableTtsText("¿Quién habla?")).toBe(true);
    expect(isSpeakableTtsText("No me interesa por ahora.")).toBe(true);
  });
});
