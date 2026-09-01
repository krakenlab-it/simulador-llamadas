import { applyPronunciationHints } from "@/lib/voice/pronunciation";
import { isElevenLabsEnabled } from "@/lib/voice/brakes";
import {
  readResponseDetail,
  redactSecrets,
  type ProviderFailure,
} from "@/lib/voice/provider-result";
import {
  TTS_PROVIDER_RETRY_FLOOR_MS,
  TTS_PROVIDER_TIMEOUT_MS,
} from "@/lib/voice/timeouts";
import { withPgClient } from "@/lib/session";
import type { SttResult } from "@/lib/voice/types";

const TTS_MODEL = "eleven_flash_v2_5";
const CONVAI_TTS_MODEL = "eleven_flash_v2_5";
const SCRIBE_MODEL = "scribe_v2";
/** ISO 639-1; required for Flash v2.5 Spanish enforcement. */
const TTS_LANGUAGE = "es";
const STT_LANGUAGE = "es-MX";
/** Documented default; sent explicitly so a plan change cannot silently alter it. */
const TTS_OUTPUT_FORMAT = "mp3_44100_128";
export const CONVAI_AGENT_KEY = "simulador-patient";

export const CONVAI_CLIENT_EVENTS = [
  "user_transcript",
  "tentative_user_transcript",
  "audio",
  "agent_response",
  "interruption",
  "ping",
  "conversation_initiation_metadata",
] as const;

export type ConvaiAgentError = {
  ok: false;
  status: number;
  detail: unknown;
  fallbackToBrowser: true;
};

export type ConvaiAgentSuccess = {
  ok: true;
  agentId: string;
};

export type ConvaiAgentResult = ConvaiAgentSuccess | ConvaiAgentError;

export type ConvaiSignedUrlResult =
  | { ok: true; signedUrl: string; agentId: string }
  | ConvaiAgentError;

/** Endpoints tried, in order, for one billed TTS turn. */
export type TtsEndpointKind = "convert" | "stream";

export type ElevenLabsTtsOutcome =
  | {
      ok: true;
      value: Buffer;
      endpoint: TtsEndpointKind;
      failures: ProviderFailure[];
    }
  | { ok: false; failures: ProviderFailure[] };

/**
 * Account-level rejections. A second endpoint cannot fix an invalid key, an
 * exhausted credit balance or a voice that does not exist, so stop and let the
 * reason reach the logs instead of doubling the latency of a doomed turn.
 */
const TERMINAL_HTTP_STATUSES = new Set([401, 402, 403, 404, 429]);

/** MP3 payloads open with an ID3 tag or an MPEG frame sync (11 set bits). */
function looksLikeMpeg(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function buildTtsUrl(kind: TtsEndpointKind, voiceId: string): string {
  const encoded = encodeURIComponent(voiceId);
  const path = kind === "stream" ? `${encoded}/stream` : encoded;
  return `https://api.elevenlabs.io/v1/text-to-speech/${path}?output_format=${TTS_OUTPUT_FORMAT}`;
}

function describeNonAudioBody(bytes: Uint8Array, contentType: string): string {
  const snippet = redactSecrets(new TextDecoder().decode(bytes.slice(0, 300)));
  return `content-type=${contentType || "none"} body=${snippet}`;
}

type AttemptResult =
  | { ok: true; value: Buffer }
  | { ok: false; failure: ProviderFailure };

async function requestElevenLabsSpeech(
  kind: TtsEndpointKind,
  apiKey: string,
  voiceId: string,
  text: string,
  withLanguageCode: boolean,
  timeoutMs: number,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = { text, model_id: TTS_MODEL };
  if (withLanguageCode) body.language_code = TTS_LANGUAGE;

  try {
    const response = await fetch(buildTtsUrl(kind, voiceId), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        failure: {
          reason: "elevenlabs_http_error",
          status: response.status,
          detail: await readResponseDetail(response),
          endpoint: kind,
        },
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.byteLength === 0) {
      return {
        ok: false,
        failure: {
          reason: "elevenlabs_empty_audio",
          status: response.status,
          endpoint: kind,
        },
      };
    }

    // A 200 carrying a JSON error body would otherwise reach the browser
    // labelled audio/mpeg and play as silence.
    if (!contentType.startsWith("audio/") && !looksLikeMpeg(bytes)) {
      return {
        ok: false,
        failure: {
          reason: "elevenlabs_non_audio_response",
          status: response.status,
          detail: describeNonAudioBody(bytes, contentType),
          endpoint: kind,
        },
      };
    }

    return { ok: true, value: Buffer.from(arrayBuffer) };
  } catch (error) {
    const aborted =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    return {
      ok: false,
      failure: {
        reason: aborted ? "elevenlabs_timeout" : "elevenlabs_exception",
        detail: redactSecrets(
          error instanceof Error ? error.message : String(error),
        ),
        endpoint: kind,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldRetryOtherEndpoint(failure: ProviderFailure): boolean {
  if (failure.reason === "elevenlabs_timeout") return false;
  if (failure.status !== undefined) {
    return !TERMINAL_HTTP_STATUSES.has(failure.status);
  }
  return true;
}

export async function synthesizeWithElevenLabs(
  text: string,
): Promise<ElevenLabsTtsOutcome> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!isElevenLabsEnabled()) {
    return { ok: false, failures: [{ reason: "elevenlabs_disabled" }] };
  }
  if (!apiKey) {
    return { ok: false, failures: [{ reason: "missing_ELEVENLABS_API_KEY" }] };
  }
  if (!voiceId) {
    return { ok: false, failures: [{ reason: "missing_ELEVENLABS_VOICE_ID" }] };
  }

  const normalized = applyPronunciationHints(text);
  const deadline = Date.now() + TTS_PROVIDER_TIMEOUT_MS;
  const failures: ProviderFailure[] = [];

  // The route buffers the whole file before responding, so the streaming
  // endpoint buys nothing here; the canonical convert endpoint returns a
  // complete MP3 and is the documented way to get one.
  const first = await requestElevenLabsSpeech(
    "convert",
    apiKey,
    voiceId,
    normalized,
    true,
    TTS_PROVIDER_TIMEOUT_MS,
  );
  if (first.ok) {
    return { ok: true, value: first.value, endpoint: "convert", failures };
  }
  failures.push(first.failure);

  const remaining = deadline - Date.now();
  if (
    !shouldRetryOtherEndpoint(first.failure) ||
    remaining < TTS_PROVIDER_RETRY_FLOOR_MS
  ) {
    return { ok: false, failures };
  }

  // Last chance: streaming endpoint without language_code, the only body field
  // a given voice/model pair can reject.
  const second = await requestElevenLabsSpeech(
    "stream",
    apiKey,
    voiceId,
    normalized,
    false,
    remaining,
  );
  if (second.ok) {
    return { ok: true, value: second.value, endpoint: "stream", failures };
  }
  failures.push(second.failure);
  return { ok: false, failures };
}

/** ElevenLabs audio isolation API — runs before Scribe v2 batch. */
export async function isolateTraineeAudio(
  audioBytes: Buffer,
  mimeType: string,
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!isElevenLabsEnabled() || !apiKey) return audioBytes;

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(audioBytes)], {
      type: mimeType || "audio/webm",
    });
    form.append("audio", blob, "audio.webm");

    const response = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!response.ok) return audioBytes;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return audioBytes;
  }
}

/**
 * Trainee STT: isolation API first, then Scribe v2 batch on isolated audio.
 */
export async function transcribeWithElevenLabsScribe(
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!isElevenLabsEnabled() || !apiKey) return null;

  const isolated = await isolateTraineeAudio(audioBytes, mimeType);

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(isolated)], {
      type: mimeType || "audio/webm",
    });
    form.append("file", blob, "audio.webm");
    form.append("model_id", SCRIBE_MODEL);
    form.append("language_code", STT_LANGUAGE);
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      text?: string;
      transcription?: string;
    };
    const transcript = (data.text ?? data.transcription ?? "").trim();
    if (!transcript) return null;

    return { transcript, tier: "elevenlabs-scribe" };
  } catch {
    return null;
  }
}

/** Whether ConvAI patient persona is available (key + kill switch). */
export function isConvaiAvailable(): boolean {
  return isElevenLabsEnabled();
}

/** Build the ConvAI agent create payload per ElevenLabs agents/create docs. */
export function buildConvaiAgentPayload(
  clientName: string,
  scenarioContext: string,
  voiceId?: string,
): Record<string, unknown> {
  const prompt = `Eres ${clientName}, comprador en una llamada de ventas B2B en México.
Contexto del escenario: ${scenarioContext}.
Responde breve en español mexicano como el cliente del sector descrito (NO asumas clínica de citas ni paciente salvo que el contexto lo indique).
Permite interrupciones (barge-in). Mantén objeciones acordes al sector y temperamento del escenario.`;

  return {
    name: CONVAI_AGENT_KEY,
    platform_settings: {
      auth: {
        enable_auth: true,
      },
    },
    conversation_config: {
      agent: {
        prompt: { prompt },
        first_message: "¿Quién habla?",
        language: "es",
      },
      tts: voiceId
        ? { voice_id: voiceId, model_id: CONVAI_TTS_MODEL }
        : { model_id: CONVAI_TTS_MODEL },
      conversation: {
        client_events: [...CONVAI_CLIENT_EVENTS],
      },
      turn: {
        turn_timeout: 25,
      },
    },
  };
}

async function readPersistedAgentId(): Promise<string | null> {
  try {
    return await withPgClient(async (client) => {
      const { rows } = await client.query<{ elevenlabs_agent_id: string }>(
        `SELECT elevenlabs_agent_id FROM voice_convai_agents WHERE agent_key = $1`,
        [CONVAI_AGENT_KEY],
      );
      return rows[0]?.elevenlabs_agent_id ?? null;
    });
  } catch {
    return null;
  }
}

async function persistAgentId(agentId: string): Promise<void> {
  await withPgClient(async (client) => {
    await client.query(
      `INSERT INTO voice_convai_agents (agent_key, elevenlabs_agent_id)
       VALUES ($1, $2)
       ON CONFLICT (agent_key) DO NOTHING`,
      [CONVAI_AGENT_KEY, agentId],
    );
  });
}

async function createConvaiAgent(
  apiKey: string,
  voiceId: string | undefined,
  clientName: string,
  scenarioContext: string,
): Promise<ConvaiAgentResult> {
  const body = buildConvaiAgentPayload(clientName, scenarioContext, voiceId);

  const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const detail = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail,
      fallbackToBrowser: true,
    };
  }

  const data = detail as { agent_id?: string };
  const agentId = data.agent_id?.trim();
  if (!agentId) {
    return {
      ok: false,
      status: 502,
      detail: { error: "missing_agent_id_in_create_response" },
      fallbackToBrowser: true,
    };
  }

  return { ok: true, agentId };
}

/** Resolve agent id: env ELEVENLABS_AGENT_ID → DB → create once. */
export async function resolveConvaiAgentId(
  clientName: string,
  scenarioContext: string,
): Promise<ConvaiAgentResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      detail: { error: "missing_api_key" },
      fallbackToBrowser: true,
    };
  }

  const envAgentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (envAgentId) {
    return { ok: true, agentId: envAgentId };
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  const persisted = await readPersistedAgentId();
  if (persisted) {
    return { ok: true, agentId: persisted };
  }

  const created = await createConvaiAgent(apiKey, voiceId, clientName, scenarioContext);
  if (!created.ok) {
    return created;
  }

  await persistAgentId(created.agentId);

  const stored = await readPersistedAgentId();
  return stored ? { ok: true, agentId: stored } : created;
}

export async function getConvaiSignedUrl(
  clientName: string,
  scenarioContext: string,
): Promise<ConvaiSignedUrlResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      detail: { error: "missing_api_key" },
      fallbackToBrowser: true,
    };
  }

  const agentResult = await resolveConvaiAgentId(clientName, scenarioContext);
  if (!agentResult.ok) {
    return agentResult;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentResult.agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );

    const detail = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail,
        fallbackToBrowser: true,
      };
    }

    const data = detail as { signed_url?: string };
    const signedUrl = data.signed_url?.trim();
    if (!signedUrl) {
      return {
        ok: false,
        status: 502,
        detail: { error: "missing_signed_url" },
        fallbackToBrowser: true,
      };
    }

    return { ok: true, signedUrl, agentId: agentResult.agentId };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      detail: {
        error: "signed_url_fetch_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      fallbackToBrowser: true,
    };
  }
}
