import { afterEach, describe, expect, it } from "vitest";
import {
  CURATED_VOICE_SLOTS,
  inferVoiceGender,
  resolveCuratedVoiceId,
  resolveSlotVoiceId,
} from "@/lib/voice/voice-pool";

const SLOT_KEYS = [
  "ELEVENLABS_VOICE_ID_FEMALE_A",
  "ELEVENLABS_VOICE_ID_FEMALE_B",
  "ELEVENLABS_VOICE_ID_MALE_A",
  "ELEVENLABS_VOICE_ID_MALE_B",
] as const;

const saved = Object.fromEntries(SLOT_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of SLOT_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("curated ElevenLabs voice pool", () => {
  it("has at least two male and two female premade slots", () => {
    const females = CURATED_VOICE_SLOTS.filter((item) => item.gender === "female");
    const males = CURATED_VOICE_SLOTS.filter((item) => item.gender === "male");
    expect(females).toHaveLength(2);
    expect(males).toHaveLength(2);
    expect(new Set(CURATED_VOICE_SLOTS.map((item) => item.id)).size).toBe(4);
  });

  it("maps clinic characters to opposite genders", () => {
    expect(inferVoiceGender({ scenarioSlug: "mariana" })).toBe("female");
    expect(inferVoiceGender({ scenarioSlug: "rodrigo" })).toBe("male");
    expect(inferVoiceGender({ scenarioSlug: "efrain" })).toBe("male");
    expect(inferVoiceGender({ characterName: "Laura Méndez" })).toBe("female");
    expect(inferVoiceGender({ characterName: "Jaime Pérez" })).toBe("male");
  });

  it("does not give Mariana and Rodrigo the same voice", () => {
    const mariana = resolveCuratedVoiceId({
      scenarioSlug: "mariana",
      characterName: "Mariana Escobedo",
    });
    const rodrigo = resolveCuratedVoiceId({
      scenarioSlug: "rodrigo",
      characterName: "Rodrigo Nava",
    });
    const efrain = resolveCuratedVoiceId({
      scenarioSlug: "efrain",
      characterName: "Efraín Loera",
    });
    expect(mariana).not.toBe(rodrigo);
    expect(rodrigo).not.toBe(efrain);
    expect(mariana).toBe(CURATED_VOICE_SLOTS[0].id);
    expect(rodrigo).toBe(CURATED_VOICE_SLOTS[2].id);
    expect(efrain).toBe(CURATED_VOICE_SLOTS[3].id);
  });

  it("honors ELEVENLABS_VOICE_ID_* slot overrides without leaking values", () => {
    process.env.ELEVENLABS_VOICE_ID_FEMALE_A = "override-female-a";
    expect(resolveSlotVoiceId("female_a")).toBe("override-female-a");
    expect(JSON.stringify(CURATED_VOICE_SLOTS)).not.toMatch(/sk_|xi-api/);
  });
});
