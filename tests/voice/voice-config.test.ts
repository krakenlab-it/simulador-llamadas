import { describe, expect, it } from "vitest";
import { resolveSttTier, resolveTtsTier } from "@/lib/voice/ladder";

/**
 * Voice config API shape — mirrors GET /api/voice/config response
 * without hitting Next.js (tested via ladder resolution).
 */
describe("voice config selector", () => {
  it("maps ladder tiers to server flags for no-key CI", () => {
    const stt = resolveSttTier();
    const tts = resolveTtsTier();

    expect(stt).toBe("browser");
    expect(tts).toBe("browser");
    expect(stt !== "browser").toBe(false);
    expect(tts !== "browser").toBe(false);
  });
});
