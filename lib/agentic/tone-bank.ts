import type { ToneId, ToneProfile } from "./types";

export const TONE_BANK: ToneProfile[] = [
  {
    id: "molesto",
    label: "Molesto",
    intensity: 3,
    stickiness: 0.85,
    promptHint: "Irritado, respuestas cortas, poco paciente.",
  },
  {
    id: "intriga",
    label: "Intriga",
    intensity: 2,
    stickiness: 0.55,
    promptHint: "Curioso con reservas, deja caer pistas sin comprometerse.",
  },
  {
    id: "desconfianza",
    label: "Desconfianza",
    intensity: 2,
    stickiness: 0.75,
    promptHint: "Escéptico, pide pruebas y cuestiona motivos.",
  },
  {
    id: "prepotencia",
    label: "Prepotencia",
    intensity: 3,
    stickiness: 0.7,
    promptHint: "Dominante, minimiza al vendedor, tono superior.",
  },
  {
    id: "suave",
    label: "Suave",
    intensity: 1,
    stickiness: 0.4,
    promptHint: "Educado pero distante, evita confrontación directa.",
  },
  {
    id: "amigable",
    label: "Amigable",
    intensity: 1,
    stickiness: 0.35,
    promptHint: "Cordial, abierto a escuchar si hay valor claro.",
  },
];

export const TONE_IDS: ToneId[] = TONE_BANK.map((tone) => tone.id);

export function isToneId(value: string): value is ToneId {
  return (TONE_IDS as readonly string[]).includes(value);
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Deterministic tone selection from session seed and difficulty (1–3).
 */
export function pickTone(seed: string, difficulty: number): ToneProfile {
  const hash = hashSeed(seed || "default");
  const difficultyBias = Math.max(1, Math.min(3, difficulty || 2));
  const index =
    (hash + difficultyBias * 7) % TONE_BANK.length;
  const base = TONE_BANK[index];
  const intensity = Math.min(
    3,
    Math.max(1, base.intensity + (difficultyBias >= 3 ? 0 : -1)),
  ) as 1 | 2 | 3;
  return { ...base, intensity };
}

export function getToneById(toneId: ToneId): ToneProfile {
  return TONE_BANK.find((tone) => tone.id === toneId) ?? TONE_BANK[0];
}
