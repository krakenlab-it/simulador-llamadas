import { SeededRng } from "@/lib/kraken-lab/seed";

export interface PickLineOptions {
  sessionSeed: string;
  salt: string;
  priorClientLines?: readonly string[];
}

export function priorClientTexts(
  priorLines: readonly { role: string; text: string }[],
): string[] {
  return priorLines
    .filter((line) => line.role === "client")
    .map((line) => line.text.trim())
    .filter(Boolean);
}

/** Deterministic line pick with optional anti-repeat against prior client lines. */
export function pickVariedLine(
  pool: readonly string[],
  options: PickLineOptions,
): string {
  const uniquePool = [...new Set(pool.map((line) => line.trim()).filter(Boolean))];
  if (uniquePool.length === 0) return "";
  if (uniquePool.length === 1) return uniquePool[0];

  const used = new Set(
    (options.priorClientLines ?? []).map((text) => text.trim()).filter(Boolean),
  );
  let candidates = uniquePool.filter((line) => !used.has(line));
  if (candidates.length === 0) candidates = uniquePool;

  const rng = new SeededRng(`${options.sessionSeed}:${options.salt}`);
  return rng.pick(candidates);
}
