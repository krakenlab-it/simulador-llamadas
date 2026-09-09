import { describe, expect, it } from "vitest";
import { pickTone, TONE_IDS, isToneId } from "@/lib/agentic/tone-bank";

describe("pickTone", () => {
  it("returns a valid ToneId from seed and difficulty", () => {
    const tone = pickTone("kraken-session-abc", 2);
    expect(isToneId(tone.id)).toBe(true);
    expect(TONE_IDS).toContain(tone.id);
    expect(tone.intensity).toBeGreaterThanOrEqual(1);
    expect(tone.intensity).toBeLessThanOrEqual(3);
  });

  it("is deterministic for the same seed", () => {
    const first = pickTone("same-seed", 3);
    const second = pickTone("same-seed", 3);
    expect(first.id).toBe(second.id);
  });
});
