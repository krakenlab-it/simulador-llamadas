import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";

export type VoiceGender = "female" | "male";
export type VoiceGenderPreference = "auto" | VoiceGender;
export type CuratedVoiceSlot = "female_a" | "female_b" | "male_a" | "male_b";

/**
 * Curated premade pool — at least two voices per gender.
 * Flash v2.5 + language_code `es`/`en` keeps Spanish native (LATAM) and
 * English native. Slot ids may be overridden by ELEVENLABS_VOICE_ID_*.
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/voices
 */
export const CURATED_VOICE_SLOTS: readonly {
  slot: CuratedVoiceSlot;
  id: string;
  name: string;
  gender: VoiceGender;
}[] = [
  { slot: "female_a", id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "female" },
  { slot: "female_b", id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female" },
  { slot: "male_a", id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male" },
  { slot: "male_b", id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male" },
] as const;

export const ELEVENLABS_VOICE_SLOT_ENV: Record<CuratedVoiceSlot, string> = {
  female_a: "ELEVENLABS_VOICE_ID_FEMALE_A",
  female_b: "ELEVENLABS_VOICE_ID_FEMALE_B",
  male_a: "ELEVENLABS_VOICE_ID_MALE_A",
  male_b: "ELEVENLABS_VOICE_ID_MALE_B",
};

/** Env names only — never values. Shown in Settings / docs. */
export const ELEVENLABS_CONNECTION_ENV_NAMES = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID_FEMALE_A",
  "ELEVENLABS_VOICE_ID_FEMALE_B",
  "ELEVENLABS_VOICE_ID_MALE_A",
  "ELEVENLABS_VOICE_ID_MALE_B",
] as const;

const FEMALE_FIRST_NAMES = new Set([
  "mariana",
  "laura",
  "ana",
  "sofia",
  "maria",
  "carmen",
  "patricia",
  "lucia",
  "elena",
  "adriana",
  "valeria",
  "paola",
]);

const MALE_FIRST_NAMES = new Set([
  "rodrigo",
  "efrain",
  "jaime",
  "carlos",
  "jose",
  "jorge",
  "luis",
  "pedro",
  "diego",
  "miguel",
  "juan",
  "andres",
  "ricardo",
]);

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function firstNameOf(characterName?: string | null): string {
  const raw = (characterName ?? "").trim();
  if (!raw) return "";
  return stripDiacritics(raw.split(/\s+/)[0] ?? "").toLowerCase();
}

export function inferVoiceGender(input: {
  characterName?: string | null;
  scenarioSlug?: string | null;
}): VoiceGender {
  const slug = input.scenarioSlug?.trim().toLowerCase();
  if (slug) {
    const preset = getCatalogPreset(slug);
    if (preset) return preset.voiceGender;
  }

  const first = firstNameOf(input.characterName);
  if (FEMALE_FIRST_NAMES.has(first)) return "female";
  if (MALE_FIRST_NAMES.has(first)) return "male";
  if (first.endsWith("a")) return "female";
  return "male";
}

export function pickCuratedSlot(
  gender: VoiceGender,
  input: { characterName?: string | null; scenarioSlug?: string | null },
  genderPreference: VoiceGenderPreference = "auto",
): CuratedVoiceSlot {
  const slug = input.scenarioSlug?.trim().toLowerCase();
  if (genderPreference === "auto") {
    if (slug === "mariana") return "female_a";
    if (slug === "rodrigo") return "male_a";
    if (slug === "efrain") return "male_b";
  }

  const seed = `${slug ?? ""}:${firstNameOf(input.characterName)}`;
  const useB = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 === 1;
  if (gender === "female") return useB ? "female_b" : "female_a";
  return useB ? "male_b" : "male_a";
}

export function resolveSlotVoiceId(slot: CuratedVoiceSlot): string {
  const envName = ELEVENLABS_VOICE_SLOT_ENV[slot];
  const override = process.env[envName]?.trim();
  if (override) return override;
  const curated = CURATED_VOICE_SLOTS.find((item) => item.slot === slot);
  return curated?.id ?? CURATED_VOICE_SLOTS[0].id;
}

export function resolveCuratedVoiceId(input: {
  genderPreference?: VoiceGenderPreference | null;
  characterName?: string | null;
  scenarioSlug?: string | null;
}): string {
  const preference = input.genderPreference ?? "auto";
  const gender =
    preference === "auto"
      ? inferVoiceGender({
          characterName: input.characterName,
          scenarioSlug: input.scenarioSlug,
        })
      : preference;
  return resolveSlotVoiceId(pickCuratedSlot(gender, input, preference));
}

export function curatedVoiceForId(voiceId: string): (typeof CURATED_VOICE_SLOTS)[number] | undefined {
  return CURATED_VOICE_SLOTS.find((item) => item.id === voiceId);
}
