import { getGoogleAccessToken, getGcpProjectId } from "@/lib/voice/google-auth";
import type { SttResult } from "@/lib/voice/types";

const SPEECH_LANG = "es-MX";

export async function transcribeWithGoogleChirp3(
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  const projectId = getGcpProjectId();
  const token = await getGoogleAccessToken();
  if (!projectId || !token) return null;

  const encoding = mimeType.includes("webm")
    ? "WEBM_OPUS"
    : mimeType.includes("ogg")
      ? "OGG_OPUS"
      : "LINEAR16";

  try {
    const response = await fetch(
      `https://speech.googleapis.com/v2/projects/${projectId}/locations/us/recognizers/_:recognize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            model: "chirp_3",
            languageCodes: [SPEECH_LANG],
            autoDecodingConfig: encoding === "LINEAR16" ? {} : undefined,
            explicitDecodingConfig:
              encoding !== "LINEAR16"
                ? { encoding, sampleRateHertz: 48000 }
                : undefined,
          },
          content: audioBytes.toString("base64"),
        }),
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      results?: { alternatives?: { transcript?: string }[] }[];
    };
    const transcript =
      data.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim() ?? "";

    if (!transcript) return null;
    return { transcript, tier: "google-chirp3" };
  } catch {
    return null;
  }
}
