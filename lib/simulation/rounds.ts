import type { RoundType } from "@/lib/db/types";
import { ROUND_ORDER } from "@/lib/db/types";
import type { ClientPersona } from "@/lib/clients";
import { ROUND_EXPECTED } from "@/lib/scoring/rondas";

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

export const EXPECTED_PHRASES: Record<RoundType, string> = ROUND_EXPECTED;

const CLIENT_LINES_BY_ROUND: Record<number, string> = {
  0: "",
  1: "Eso ya lo escuché. ¿Qué resultado me trae?",
  2: "Explíqueme en una frase qué medirían.",
  3: "Mande su correo, pero sea breve.",
  4: "Si no hay fecha en la agenda, no hay reunión.",
};

export function getRoundMeta(roundIndex: number): RoundMeta | null {
  return ROUNDS[roundIndex] ?? null;
}

export function getClientLine(client: ClientPersona, roundIndex: number): string {
  if (roundIndex === 0) {
    return client.openings[0];
  }
  return CLIENT_LINES_BY_ROUND[roundIndex] ?? "...";
}

export function getExpectedPhrase(roundType: RoundType): string {
  return EXPECTED_PHRASES[roundType];
}

export function isValidRoundIndex(index: number): boolean {
  return index >= 0 && index < ROUND_ORDER.length;
}
