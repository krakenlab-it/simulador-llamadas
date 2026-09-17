import type { RoundType } from "@/lib/db/types";
import { ROUND_ORDER } from "@/lib/db/types";
import type { ClientPersona } from "@/lib/clients";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";
import { getClinicOpeningLine } from "./openings";
import { pickVariedLine } from "./session-variation";

export interface RoundMeta {
  key: RoundType;
  label: string;
}

export const ROUNDS: readonly RoundMeta[] = [
  { key: "apertura", label: "Apertura" },
  { key: "objecion", label: "Objeción" },
  { key: "claridad", label: "Claridad" },
  { key: "correo", label: "Correo" },
  { key: "cierre", label: "Cierre" },
] as const;

/** Scoring phases in the clinic ladder (UI progress, not a message cap). */
export const CLINIC_PHASE_COUNT = ROUNDS.length;

export const EXPECTED_PHRASES: Record<RoundType, string> = ROUND_EXPECTED;

const CLIENT_LINES_BY_ROUND: readonly string[][] = [
  [],
  [
    "Eso ya lo escuché. ¿Qué resultado me trae?",
    "Suena repetido. ¿Qué resultado concreto trae?",
    "Ya me lo dijeron. ¿Qué cambia con ustedes?",
  ],
  [
    "Explíqueme en una frase qué medirían.",
    "Una frase: ¿qué medirían?",
    "Resuma en una frase la métrica.",
  ],
  [
    "Mande su correo, pero sea breve.",
    "Puede escribir, pero corto.",
    "Correo sí, sin rodeos.",
  ],
  [
    "Si no hay fecha en la agenda, no hay reunión.",
    "Sin día en calendario no avanzo.",
    "Necesito fecha en agenda o no sigo.",
  ],
];

export function getRoundMeta(roundIndex: number): RoundMeta | null {
  return ROUNDS[roundIndex] ?? null;
}

export function getClientLine(
  client: ClientPersona,
  roundIndex: number,
  sessionSeed?: string,
  priorClientLines?: readonly string[],
): string {
  if (roundIndex === 0) {
    if (sessionSeed?.trim()) {
      return getClinicOpeningLine(client, sessionSeed, priorClientLines);
    }
    return client.openings[0];
  }

  const pool = CLIENT_LINES_BY_ROUND[roundIndex];
  if (!pool?.length) return "...";
  if (!sessionSeed?.trim()) return pool[0];

  return pickVariedLine(pool, {
    sessionSeed,
    salt: `round-preview:${roundIndex}`,
    priorClientLines,
  });
}

export function getExpectedPhrase(roundType: RoundType): string {
  return EXPECTED_PHRASES[roundType];
}

export function isValidRoundIndex(index: number): boolean {
  return index >= 0 && index < ROUND_ORDER.length;
}
