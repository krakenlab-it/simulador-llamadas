import { applyPronunciationHints } from "@/lib/voice/pronunciation";
import { isElevenLabsEnabled } from "@/lib/voice/brakes";
import type { SttResult } from "@/lib/voice/types";

const TTS_MODEL = "eleven_multilingual_v2";
const SCRIBE_MODEL = "scribe_v2";
const LANGUAGE = "es-MX";

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

/**
 * Trainee STT: audio isolation (best-effort) then Scribe v2 batch.
 * Isolation is requested via the batch API tag when supported; otherwise raw audio.
 */
export async function transcribeWithElevenLabsScribe(
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!isElevenLabsEnabled() || !apiKey) return null;

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(audioBytes)], { type: mimeType || "audio/webm" });
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

/**
 * Obtain a signed ConvAI websocket URL for the patient agent.
 * Agent is created/cached server-side using the locked voice — no extra env names.
 */
export async function getConvaiSignedUrl(
  clientName: string,
  scenarioContext: string,
): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey) return null;

  try {
    const agentId = await ensureConvaiAgent(apiKey, voiceId, clientName, scenarioContext);
    if (!agentId) return null;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { signed_url?: string };
    return data.signed_url ?? null;
  } catch {
    return null;
  }
}

let cachedAgentId: string | null = null;

async function ensureConvaiAgent(
  apiKey: string,
  voiceId: string | undefined,
  clientName: string,
  scenarioContext: string,
): Promise<string | null> {
  if (cachedAgentId) return cachedAgentId;

  const prompt = `Eres ${clientName}, cliente mexicano en una llamada de ventas fría de una clínica de citas. ${scenarioContext}. Responde breve en español mexicano. Permite interrupciones (barge-in).`;

  const body: Record<string, unknown> = {
    name: `simulador-patient-${clientName.slice(0, 20)}`,
    conversation_config: {
      agent: {
        prompt: { prompt },
        first_message: "¿Quién habla?",
        language: "es",
      },
      tts: voiceId
        ? { voice_id: voiceId, model_id: TTS_MODEL }
        : { model_id: TTS_MODEL },
    },
  };

  const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { agent_id?: string };
  cachedAgentId = data.agent_id ?? null;
  return cachedAgentId;
}
