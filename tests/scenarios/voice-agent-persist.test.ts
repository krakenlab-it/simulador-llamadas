import { describe, expect, it } from "vitest";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  PREMADE_VOICES,
  applyVoiceAgentToRecord,
  parseVoiceAgentSettings,
  voiceAgentFromRecord,
} from "@/lib/voice/agent-settings";

describe("voice agent persistence on the scenario", () => {
  it("starts from defaults when a scenario has never stored knobs", () => {
    expect(voiceAgentFromRecord(marianaScenarioFixture)).toEqual(
      DEFAULT_VOICE_AGENT_SETTINGS,
    );
  });

  it("round-trips trainer knobs on the same scenario record", () => {
    const saved = {
      language: "en" as const,
      voiceGender: "auto" as const,
      voiceId: PREMADE_VOICES[3].id,
      voiceOverride: true,
      speakingRate: "lento" as const,
      personality: "impaciente" as const,
      difficultyLevel: 2 as const,
      bargeIn: true,
      advancedOpen: true,
      clientLayer: { motorEnabled: true, toneId: "desconfianza" as const },
    };

    const updated = applyVoiceAgentToRecord(marianaScenarioFixture, saved);

    expect(updated.voiceAgent).toEqual(saved);
    expect(voiceAgentFromRecord(updated)).toEqual(saved);
    expect(updated.config).toEqual(marianaScenarioFixture.config);
  });

  it("replay of the saved record uses the same premade voice and barge-in", () => {
    const first = applyVoiceAgentToRecord(marianaScenarioFixture, {
      language: "es",
      voiceGender: "auto",
      voiceId: PREMADE_VOICES[1].id,
      voiceOverride: true,
      speakingRate: "rapido",
      personality: "paciente",
      difficultyLevel: 3,
      bargeIn: true,
      advancedOpen: false,
      clientLayer: { motorEnabled: true, toneId: "auto" },
    });

    const replay = voiceAgentFromRecord(first);

    expect(replay.voiceId).toBe(PREMADE_VOICES[1].id);
    expect(replay.voiceId).not.toBe("library-paid-voice");
    expect(replay.bargeIn).toBe(true);
    expect(replay.difficultyLevel).toBe(3);
    expect(isPremadeOnReplay(replay.voiceId)).toBe(true);
  });

  it("coerces a persisted library voice back to the premade default", () => {
    const tainted = {
      ...marianaScenarioFixture,
      voiceAgent: parseVoiceAgentSettings({
        language: "es",
        voiceId: "JBFqnCBsd6RMkjVDRZzb-library-copy",
        speakingRate: "normal",
        personality: "neutral",
        difficultyLevel: 1,
        bargeIn: false,
      }),
    };

    expect(voiceAgentFromRecord(tainted).voiceId).toBe("");
    expect(voiceAgentFromRecord(tainted).voiceOverride).toBe(false);
  });
});

function isPremadeOnReplay(voiceId: string): boolean {
  return PREMADE_VOICES.some((voice) => voice.id === voiceId);
}
