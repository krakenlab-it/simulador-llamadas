import { describe, expect, it } from "vitest";
import { ELEVENLABS_DEFAULT_PREMADE_VOICE } from "@/lib/voice/providers/elevenlabs";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  PREMADE_VOICES,
  clampSpeakingRate,
  isPremadeVoiceId,
  parseVoiceAgentSettings,
  resolvePremadeVoiceId,
  speakingRateToNumber,
  temperamentWithPersonality,
} from "@/lib/voice/agent-settings";
import {
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_TTS_MAX_CHARS_PER_TURN,
} from "@/lib/voice/brakes";

describe("trainer voice-agent settings", () => {
  it("defaults to Spanish, Sarah, normal rate, and barge-in off", () => {
    expect(DEFAULT_VOICE_AGENT_SETTINGS).toEqual({
      language: "es",
      voiceId: ELEVENLABS_DEFAULT_PREMADE_VOICE.id,
      speakingRate: "normal",
      personality: "neutral",
      difficultyLevel: 1,
      bargeIn: false,
    });
  });

  it("only catalogs documented premade voices", () => {
    expect(PREMADE_VOICES.every((voice) => isPremadeVoiceId(voice.id))).toBe(
      true,
    );
    expect(PREMADE_VOICES.some((voice) => voice.id === ELEVENLABS_DEFAULT_PREMADE_VOICE.id)).toBe(
      true,
    );
    expect(isPremadeVoiceId("21m00Tcm4TlvDq8ikWAM")).toBe(false);
    expect(isPremadeVoiceId("library-paid-voice")).toBe(false);
  });

  it("falls back to Sarah when a library or unknown voice is requested", () => {
    expect(resolvePremadeVoiceId("library-paid-voice")).toBe(
      ELEVENLABS_DEFAULT_PREMADE_VOICE.id,
    );
    expect(resolvePremadeVoiceId(PREMADE_VOICES[2].id)).toBe(PREMADE_VOICES[2].id);
  });

  it("parses a saved scenario payload and ignores unknown fields", () => {
    const parsed = parseVoiceAgentSettings({
      language: "en",
      voiceId: PREMADE_VOICES[1].id,
      speakingRate: "rapido",
      personality: "esceptico",
      difficultyLevel: 3,
      bargeIn: true,
      extraIsland: "nope",
    });

    expect(parsed).toEqual({
      language: "en",
      voiceId: PREMADE_VOICES[1].id,
      speakingRate: "rapido",
      personality: "esceptico",
      difficultyLevel: 3,
      bargeIn: true,
    });
  });

  it("rejects a library voice id when parsing persisted settings", () => {
    const parsed = parseVoiceAgentSettings({
      language: "es",
      voiceId: "voice-library-secret",
      speakingRate: "lento",
      personality: "impaciente",
      difficultyLevel: 2,
      bargeIn: false,
    });

    expect(parsed.voiceId).toBe(ELEVENLABS_DEFAULT_PREMADE_VOICE.id);
    expect(parsed.speakingRate).toBe("lento");
  });

  it("clamps speaking rate to the billed TTS-safe window", () => {
    expect(speakingRateToNumber("lento")).toBe(0.85);
    expect(speakingRateToNumber("normal")).toBe(1);
    expect(speakingRateToNumber("rapido")).toBe(1.15);
    expect(clampSpeakingRate(0.1)).toBe(0.7);
    expect(clampSpeakingRate(4)).toBe(1.2);
  });

  it("overlays personality onto existing temperament without rewriting language prompts", () => {
    expect(temperamentWithPersonality("Directo", "esceptico")).toContain(
      "Escéptico",
    );
    expect(temperamentWithPersonality("Escéptico, poco tiempo", "esceptico")).toBe(
      "Escéptico, poco tiempo",
    );
  });

  it("does not raise billed TTS spend brakes when agent knobs are present", () => {
    expect(SESSION_EXTRA_TTS_MAX_CHARS).toBe(4000);
    expect(SESSION_TTS_MAX_CHARS_PER_TURN).toBe(480);
    const parsed = parseVoiceAgentSettings({
      ...DEFAULT_VOICE_AGENT_SETTINGS,
      speakingRate: "rapido",
      bargeIn: true,
    });
    expect(parsed.speakingRate).toBe("rapido");
    expect(SESSION_EXTRA_TTS_MAX_CHARS).toBe(4000);
    expect(SESSION_TTS_MAX_CHARS_PER_TURN).toBe(480);
  });
});
