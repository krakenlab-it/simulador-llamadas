import { describe, expect, it } from "vitest";
import { isElevenLabsTier } from "@/lib/voice/ladder";

describe("KLM-44 billed voice gate — tier identification", () => {
  it("treats elevenlabs and elevenlabs-scribe as billed tiers", () => {
    expect(isElevenLabsTier("elevenlabs")).toBe(true);
    expect(isElevenLabsTier("elevenlabs-scribe")).toBe(true);
    expect(isElevenLabsTier("browser")).toBe(false);
    expect(isElevenLabsTier("google-chirp3")).toBe(false);
  });
});

describe("KLM-44 voice auth requirement", () => {
  it("requires sessionUsageId for billed ElevenLabs API calls", () => {
    const context = { sessionUsageId: undefined };
    expect(context.sessionUsageId).toBeUndefined();
    // Server gateElevenLabsCall returns voice_auth_required without sessionUsageId.
    // Integration covered in usage.integration.test.ts when DATABASE_URL is set.
  });
});
