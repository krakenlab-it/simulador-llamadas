import { describe, expect, it } from "vitest";
import {
  canStartTraining,
  startBlockedReason,
} from "@/lib/frontend/training-readiness";

describe("training readiness", () => {
  const base = {
    scenarioSelected: true,
    mode: "texto" as const,
    speechSupported: true,
    micVerified: false,
    isStarting: false,
  };

  it("allows text mode without mic verification", () => {
    expect(canStartTraining(base)).toBe(true);
    expect(startBlockedReason(base)).toBeNull();
  });

  it("requires a selected scenario", () => {
    const input = { ...base, scenarioSelected: false };
    expect(canStartTraining(input)).toBe(false);
    expect(startBlockedReason(input)).toBe("Elige un escenario para empezar.");
  });

  it("requires mic verification in voice mode", () => {
    const input = { ...base, mode: "voz" as const, micVerified: false };
    expect(canStartTraining(input)).toBe(false);
    expect(startBlockedReason(input)).toBe(
      "Verifica tu micrófono antes de iniciar.",
    );
  });

  it("allows voice mode after mic check", () => {
    const input = { ...base, mode: "voz" as const, micVerified: true };
    expect(canStartTraining(input)).toBe(true);
  });

  it("requires voice auth when configured in voice mode", () => {
    const input = {
      ...base,
      mode: "voz" as const,
      micVerified: true,
      needsVoiceAuth: true,
      voiceAuthVerified: false,
    };
    expect(canStartTraining(input)).toBe(false);
    expect(startBlockedReason(input)).toContain("correo");
  });

  it("allows voice mode when voice auth is satisfied", () => {
    const input = {
      ...base,
      mode: "voz" as const,
      micVerified: true,
      needsVoiceAuth: true,
      voiceAuthVerified: true,
    };
    expect(canStartTraining(input)).toBe(true);
  });

  it("blocks when speech is unsupported in voice mode", () => {
    const input = {
      ...base,
      mode: "voz" as const,
      speechSupported: false,
      micVerified: true,
    };
    expect(canStartTraining(input)).toBe(false);
    expect(startBlockedReason(input)).toContain("no soporta voz");
  });

  it("blocks while a session is starting", () => {
    const input = { ...base, isStarting: true };
    expect(canStartTraining(input)).toBe(false);
    expect(startBlockedReason(input)).toBe("Conectando la llamada…");
  });
});
