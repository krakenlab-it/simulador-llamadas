import { applyPronunciationHints } from "@/lib/voice/pronunciation";
import { isElevenLabsEnabled } from "@/lib/voice/brakes";
import { withPgClient } from "@/lib/session";
import type { SttResult } from "@/lib/voice/types";

const TTS_MODEL = "eleven_multilingual_v2";
const CONVAI_TTS_MODEL = "eleven_flash_v2_5";
const SCRIBE_MODEL = "scribe_v2";
const LANGUAGE = "es-MX";
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

export async function synthesizeWithElevenLabs(
  text: string,
): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!isElevenLabsEnabled() || !apiKey || !voiceId) return null;

  const normalized = applyPronunciationHints(text);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: normalized,
          model_id: TTS_MODEL,
          language_code: LANGUAGE,
        }),
      },
    );

    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
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
    form.append("language_code", LANGUAGE);
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
  const prompt = `Eres ${clientName}, cliente mexicano en una llamada de ventas fría de una clínica de citas. ${scenarioContext}. Responde breve en español mexicano. Permite interrupciones (barge-in).`;

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
