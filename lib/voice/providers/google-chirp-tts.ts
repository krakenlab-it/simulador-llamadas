import { getGoogleAccessToken } from "@/lib/voice/google-auth";
import { applyPronunciationHints } from "@/lib/voice/pronunciation";

const VOICE = "es-US-Chirp3-HD-Kore";
const LANGUAGE = "es-US";

export async function synthesizeWithGoogleChirp3(
  text: string,
): Promise<Buffer | null> {
  const token = await getGoogleAccessToken();
  if (!token) return null;

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

    if (!response.ok) return null;

    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) return null;
    return Buffer.from(data.audioContent, "base64");
  } catch {
    return null;
  }
}
