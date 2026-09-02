import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { synthesizeSpeech } from "@/lib/voice/tts";

/** One short Spanish clinic line — keeps the free 10k-char quota safe. */
export const TTS_PROOF_LINE =
  "Buenos días, le llamo de la clínica para confirmar su cita de mañana.";

export const TTS_PROOF_FILENAME = "clinic-line-proof.mp3";

const CURSOR_ARTIFACTS_ROOT = "/opt/cursor/artifacts";

export function isTtsProofEnvReady(): boolean {
  const enabled = process.env.ELEVENLABS_ENABLED?.trim().toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") return false;
  return Boolean(
    process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim(),
  );
}

export function ttsProofSkipMessage(): string {
  return (
    "Skipping TTS proof: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID " +
    "(ELEVENLABS_ENABLED must not be false) to run a live ElevenLabs synthesis."
  );
}

/** MP3 (ID3 or frame sync) or WAV (RIFF) header check. */
export function isValidAudioBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return true;
  }
  return false;
}

export function ttsProofOutputDirs(): { repo: string; cloud: string | null } {
  const repo = path.join(process.cwd(), "artifacts", "tts-proof");
  const cloud = pathExists(CURSOR_ARTIFACTS_ROOT)
    ? path.join(CURSOR_ARTIFACTS_ROOT, "tts-proof")
    : null;
  return { repo, cloud };
}

function pathExists(target: string): boolean {
  try {
    mkdirSync(target, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function writeTtsProofFile(bytes: Buffer): string[] {
  const written: string[] = [];
  const { repo, cloud } = ttsProofOutputDirs();

  for (const dir of [repo, cloud].filter(Boolean) as string[]) {
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, TTS_PROOF_FILENAME);
    writeFileSync(filePath, bytes);
    written.push(filePath);
  }

  return written;
}

export type TtsProofResult = {
  paths: string[];
  bytes: Buffer;
  mimeType: string;
  endpoint?: string;
};

export type TtsRouteProofResult = TtsProofResult & {
  httpStatus: number;
};

/**
 * Live proof: billed synthesis through lib/voice/tts → ElevenLabs (premade
 * Sarah fallback on library 402). No stubs.
 */
export async function runTtsProof(
  line: string = TTS_PROOF_LINE,
): Promise<TtsProofResult> {
  const outcome = await synthesizeSpeech(line);
  if (!outcome.result) {
    const detail = outcome.failures
      .map((f) => `${f.endpoint ?? "n/a"}:${f.reason}${f.status ? `:${f.status}` : ""}`)
      .join(" | ");
    throw new Error(`TTS proof synthesis failed: ${detail || "unknown"}`);
  }

  const bytes = outcome.result.audio;
  if (!isValidAudioBytes(bytes)) {
    throw new Error(
      `TTS proof returned non-audio payload (${bytes.byteLength} bytes)`,
    );
  }

  const paths = writeTtsProofFile(bytes);
  return {
    paths,
    bytes,
    mimeType: outcome.result.mimeType,
    endpoint: outcome.result.endpoint,
  };
}

/** Route proof helper: validates MPEG bytes from a POST /api/voice/tts Response. */
export function proofFromTtsRouteResponse(
  response: Response,
  paths?: string[],
): TtsRouteProofResult {
  if (response.status !== 200) {
    throw new Error(`TTS route proof expected 200, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/")) {
    throw new Error(`TTS route proof expected audio/*, got ${contentType || "none"}`);
  }
  return {
    paths: paths ?? [],
    bytes: Buffer.alloc(0),
    mimeType: contentType,
    httpStatus: response.status,
    endpoint: response.headers.get("x-voice-endpoint") ?? undefined,
  };
}

export async function collectTtsRouteProofBytes(response: Response): Promise<Buffer> {
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  if (!isValidAudioBytes(bytes)) {
    throw new Error(
      `TTS route proof returned non-audio payload (${bytes.byteLength} bytes)`,
    );
  }
  return bytes;
}
