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
  it("auth verify route requires Bearer token (no raw email body)", async () => {
    const { POST } = await import("@/app/api/voice/auth/verify/route");
    const response = await POST(
      new Request("http://localhost/api/voice/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "attacker@example.com" }),
      }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("voice_auth_required");
  });

  it("session start rejects requests without Bearer token", async () => {
    const savedKey = process.env.ELEVENLABS_API_KEY;
    const savedEnabled = process.env.ELEVENLABS_ENABLED;
    process.env.ELEVENLABS_API_KEY = "test-key";

    const { POST } = await import("@/app/api/voice/session/start/route");
    const response = await POST(
      new Request("http://localhost/api/voice/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callAttemptId: "fake" }),
      }),
    );

    if (savedKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = savedKey;
    if (savedEnabled === undefined) delete process.env.ELEVENLABS_ENABLED;
    else process.env.ELEVENLABS_ENABLED = savedEnabled;

    expect(response.status).toBe(401);
  });
});
