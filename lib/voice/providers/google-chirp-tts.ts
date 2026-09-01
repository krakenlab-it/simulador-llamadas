import { getGoogleAccessToken } from "@/lib/voice/google-auth";
import { applyPronunciationHints } from "@/lib/voice/pronunciation";
import {
  providerSkipped,
  readResponseDetail,
  type ProviderOutcome,
} from "@/lib/voice/provider-result";

const VOICE = "es-US-Chirp3-HD-Kore";
const LANGUAGE = "es-US";

export async function synthesizeWithGoogleChirp3(
  text: string,
): Promise<ProviderOutcome<Buffer>> {
  const token = await getGoogleAccessToken();
  if (!token) {
    return providerSkipped("missing_GOOGLE_APPLICATION_CREDENTIALS");
  }

  const normalized = applyPronunciationHints(text);

  try {
    const response = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: normalized },
          voice: { languageCode: LANGUAGE, name: VOICE },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: "google_chirp_http_error",
        status: response.status,
        detail: await readResponseDetail(response),
      };
    }

    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) {
      return { ok: false, reason: "google_chirp_empty_audio" };
    }
    return { ok: true, value: Buffer.from(data.audioContent, "base64") };
  } catch (error) {
    return {
      ok: false,
      reason: "google_chirp_exception",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
