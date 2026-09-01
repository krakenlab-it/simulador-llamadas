import { afterEach, describe, expect, it } from "vitest";
import {
  isServerSttTier,
  isServerTtsTier,
  resolveSttTier,
  resolveTtsTier,
  resolveVoiceLadder,
} from "@/lib/voice/ladder";
import { applyPronunciationHints, getPronunciationTerms } from "@/lib/voice/pronunciation";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_ENABLED",
  "ELEVENLABS_CONVAI_ENABLED",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_API_KEY",
  "GCP_PROJECT_ID",
] as const;

function clearVoiceEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

describe("voice ladder — no keys (CI default)", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("resolves browser STT when no env vars are set", () => {
    clearVoiceEnv();
    expect(resolveSttTier()).toBe("browser");
    expect(isServerSttTier(resolveSttTier())).toBe(false);
  });

  it("resolves browser TTS when no env vars are set", () => {
    clearVoiceEnv();
    expect(resolveTtsTier()).toBe("browser");
    expect(isServerTtsTier(resolveTtsTier())).toBe(false);
  });

  it("returns full browser ladder config with convai disabled", () => {
    clearVoiceEnv();
    const ladder = resolveVoiceLadder();
    expect(ladder).toEqual({
      sttTier: "browser",
      ttsTier: "browser",
      convaiEnabled: false,
      pronunciationDictionary: false,
      elevenlabsBilledAvailable: false,
    });
  });
});

describe("voice ladder — Google API key only", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("uses Gemini transcribe STT and Gemini flash TTS", () => {
    clearVoiceEnv();
    process.env.GOOGLE_API_KEY = "test-key";

    expect(resolveSttTier()).toBe("google-gemini-transcribe");
    expect(resolveTtsTier()).toBe("google-gemini-flash");

    const ladder = resolveVoiceLadder();
    expect(ladder.sttTier).toBe("google-gemini-transcribe");
    expect(ladder.ttsTier).toBe("google-gemini-flash");
    expect(ladder.convaiEnabled).toBe(false);
  });
});

describe("voice ladder — GCP service account", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("uses Chirp3 STT when creds and project id are set", () => {
    clearVoiceEnv();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";
    process.env.GCP_PROJECT_ID = "my-project";

    expect(resolveSttTier()).toBe("google-chirp3");
  });

  it("uses Chirp3 TTS when only creds are set", () => {
    clearVoiceEnv();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";

    expect(resolveTtsTier()).toBe("google-chirp3");
    expect(resolveVoiceLadder().pronunciationDictionary).toBe(true);
  });
});

describe("voice ladder — ElevenLabs", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("prefers Scribe STT when ElevenLabs key is set and enabled", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.ELEVENLABS_VOICE_ID = "voice-123";

    expect(resolveSttTier()).toBe("elevenlabs-scribe");
    expect(resolveVoiceLadder().elevenlabsBilledAvailable).toBe(true);
  });

  it("keeps ConvAI off the call path unless it is opted into explicitly", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.ELEVENLABS_VOICE_ID = "voice-123";

    // Billed TTS is available, but the call still runs on browser mic + TTS.
    expect(resolveTtsTier()).toBe("elevenlabs");
    expect(resolveVoiceLadder().convaiEnabled).toBe(false);

    process.env.ELEVENLABS_CONVAI_ENABLED = "true";
    expect(resolveVoiceLadder().convaiEnabled).toBe(true);
  });

  it("skips ElevenLabs when ELEVENLABS_ENABLED=false", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.ELEVENLABS_ENABLED = "false";

    expect(resolveSttTier()).toBe("browser");
    expect(resolveVoiceLadder().elevenlabsBilledAvailable).toBe(false);
  });

  it("uses ElevenLabs TTS only when key and voice id are both set", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.ELEVENLABS_VOICE_ID = "voice-123";

    expect(resolveTtsTier()).toBe("elevenlabs");
  });

  it("degrades TTS to next tier when voice id is missing", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.GOOGLE_API_KEY = "g-test";

    expect(resolveTtsTier()).toBe("google-gemini-flash");
  });

  it("degrades TTS to Chirp when voice id missing but GCP creds set", () => {
    clearVoiceEnv();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";

    expect(resolveTtsTier()).toBe("google-chirp3");
  });
});

describe("pronunciation dictionary", () => {
  it("normalizes clinic terms for TTS", () => {
    expect(applyPronunciationHints("Visitas a caseta y m² en showroom")).toContain(
      "caseta",
    );
    expect(applyPronunciationHints("ROI y KPI")).toContain("ROI");
  });

  it("exposes clinic term list", () => {
    expect(getPronunciationTerms()).toContain("caseta");
    expect(getPronunciationTerms()).toContain("showroom");
  });
});
