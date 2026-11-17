import { applyPronunciationHints } from "@/lib/voice/pronunciation";
import {
  providerSkipped,
  readResponseDetail,
  type ProviderOutcome,
} from "@/lib/voice/provider-result";
import { normalizeGeminiTtsAudioBytes } from "@/lib/voice/providers/google-gemini-tts-audio";

/** GA successor for shut-down preview TTS (see Gemini API deprecations). */
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";

const VOICE = "Kore";
const LANGUAGE = "es-US";

export function resolveGeminiTtsModel(): string {
  const override = process.env.GEMINI_TTS_MODEL?.trim();
  return override || DEFAULT_GEMINI_TTS_MODEL;
}

export const GEMINI_TTS_MODEL = DEFAULT_GEMINI_TTS_MODEL;

/** Gemini API-key TTS (Kore voice, es-US). */
export async function synthesizeWithGeminiFlash(
  text: string,
): Promise<ProviderOutcome<Buffer>> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return providerSkipped("missing_GOOGLE_API_KEY");
  }

  const model = resolveGeminiTtsModel();
  const normalized = applyPronunciationHints(text);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Say in ${LANGUAGE} with voice ${VOICE}: ${normalized}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICE },
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: "google_gemini_http_error",
        status: response.status,
        detail: await readResponseDetail(response),
      };
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data?: string; mimeType?: string } }[];
        };
      }[];
    };

    const inline =
      data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
        ?.inlineData;
    if (!inline?.data) {
      return { ok: false, reason: "google_gemini_empty_audio" };
    }

    const raw = Buffer.from(inline.data, "base64");
    const audio = normalizeGeminiTtsAudioBytes(raw, inline.mimeType);
    return { ok: true, value: audio };
  } catch (error) {
    return {
      ok: false,
      reason: "google_gemini_exception",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}