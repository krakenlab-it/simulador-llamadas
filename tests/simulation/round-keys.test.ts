import { describe, expect, it } from "vitest";
import { resolveRoundKey } from "@/lib/simulation/round-keys";

describe("resolveRoundKey", () => {
  it("keeps the phase key for the first pass through each clinic phase", () => {
    expect(resolveRoundKey("cierre", 5)).toBe("cierre");
    expect(resolveRoundKey("apertura", 1)).toBe("apertura");
  });

  it("suffixes follow-up turns so round_key stays unique per call", () => {
    expect(resolveRoundKey("cierre", 6)).toBe("cierre-6");
    expect(resolveRoundKey("cierre", 10)).toBe("cierre-10");
  });
});
