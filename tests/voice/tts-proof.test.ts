import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectTtsRouteProofBytes,
  isTtsProofEnvReady,
  isValidAudioBytes,
  runTtsProof,
  TTS_PROOF_FILENAME,
  TTS_PROOF_LINE,
  ttsProofOutputDirs,
  ttsProofSkipMessage,
} from "@/lib/voice/tts-proof";

vi.mock("@/lib/session", () => ({
  withPgClient: vi.fn(async (fn: (client: unknown) => unknown) => fn({})),
}));

vi.mock("@/lib/voice/gates", () => ({
  gateElevenLabsCall: vi.fn(async () => ({ allowed: true, fallbackToBrowser: false })),
}));

vi.mock("@/lib/voice/usage", () => ({
  recordExtraTtsChars: vi.fn(async () => undefined),
  getSessionUsage: vi.fn(async () => ({
    id: "usage-proof",
    verifiedUserId: "verified-proof",
    convaiSecondsUsed: 0,
    traineeAudioSecondsUsed: 0,
    extraTtsCharsUsed: 0,
    convaiSlotHeld: false,
  })),
}));

vi.mock("@/lib/auth/require-voice-session", () => ({
  resolveVoiceAuth: vi.fn(async () => ({
    supabaseUserId: "sb-proof",
    email: "proof@example.com",
    accessToken: "token",
    verifiedUserId: "verified-proof",
  })),
  isVoiceAuthContext: () => true,
  assertSessionOwnership: vi.fn(async () => true),
}));

import { POST } from "@/app/api/voice/tts/route";

const MP3_HEADER = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x11, 0x22]);

describe("tts-proof helpers", () => {
  it("isValidAudioBytes accepts ID3 and MPEG sync headers", () => {
    expect(isValidAudioBytes(MP3_HEADER)).toBe(true);
    expect(isValidAudioBytes(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toBe(true);
    expect(isValidAudioBytes(new Uint8Array())).toBe(false);
    expect(isValidAudioBytes(new Uint8Array([0x00, 0x01]))).toBe(false);
  });

  it("isTtsProofEnvReady is false without ELEVENLABS_API_KEY", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-123");
    vi.stubEnv("ELEVENLABS_ENABLED", "true");
    expect(isTtsProofEnvReady()).toBe(false);
    expect(ttsProofSkipMessage()).toContain("ELEVENLABS_API_KEY");
    vi.unstubAllEnvs();
  });

  it("isTtsProofEnvReady is false when ELEVENLABS_ENABLED=false", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk-test");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-123");
    vi.stubEnv("ELEVENLABS_ENABLED", "false");
    expect(isTtsProofEnvReady()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("isTtsProofEnvReady is true when key and voice id are set", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk-test");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-123");
    vi.stubEnv("ELEVENLABS_ENABLED", "true");
    expect(isTtsProofEnvReady()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("tts proof (live ElevenLabs)", () => {
  const dirs = ttsProofOutputDirs();

  beforeEach(() => {
    for (const dir of [dirs.repo, dirs.cloud].filter(Boolean) as string[]) {
      mkdirSync(dir, { recursive: true });
      try {
        rmSync(path.join(dir, TTS_PROOF_FILENAME), { force: true });
      } catch {
        // ignore
      }
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const liveIt = isTtsProofEnvReady() ? it : it.skip;

  liveIt(
    "synthesizeSpeech writes clinic-line-proof.mp3 with valid MPEG bytes",
    async () => {
      const result = await runTtsProof(TTS_PROOF_LINE);

      expect(result.bytes.byteLength).toBeGreaterThan(0);
      expect(isValidAudioBytes(result.bytes)).toBe(true);
      expect(result.mimeType).toBe("audio/mpeg");
      expect(result.paths.length).toBeGreaterThan(0);

      for (const filePath of result.paths) {
        const onDisk = readFileSync(filePath);
        expect(onDisk.byteLength).toBeGreaterThan(0);
        expect(isValidAudioBytes(onDisk)).toBe(true);
      }
    },
    45_000,
  );

  liveIt(
    "POST /api/voice/tts returns 200 MPEG using the production route stack",
    async () => {
      const response = await POST(
        new Request("https://example.com/api/voice/tts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-voice-session-id": "usage-proof",
          },
          body: JSON.stringify({
            text: TTS_PROOF_LINE,
            sessionUsageId: "usage-proof",
          }),
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^audio\//);

      const bytes = await collectTtsRouteProofBytes(response);
      expect(bytes.byteLength).toBeGreaterThan(0);
      expect(isValidAudioBytes(bytes)).toBe(true);
    },
    45_000,
  );

  if (!isTtsProofEnvReady()) {
    it("skips live proof when ELEVENLABS_API_KEY is missing", () => {
      expect(ttsProofSkipMessage()).toMatch(/Skipping TTS proof/i);
    });
  }
});
