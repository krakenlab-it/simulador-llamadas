/**
 * Deterministic pseudo-random utilities for Kraken Lab session generation.
 * Same seed + inputs always produce the same personas and dialogue battery.
 */

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRng {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(String(seed));
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return items[this.int(0, items.length - 1)];
  }

  pickMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i += 1) {
      const idx = this.int(0, pool.length - 1);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export function buildSessionSeed(parts: string[]): string {
  return parts.filter(Boolean).join("|");
}
