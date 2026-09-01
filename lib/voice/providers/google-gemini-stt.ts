import type { SttResult } from "@/lib/voice/types";

/** Spec target: gemini-3.5-transcribe-preview; falls back to flash multimodal. */
export const GEMINI_TRANSCRIBE_MODEL = "gemini-2.0-flash";

/** Gemini API-key STT via multimodal generateContent (transcribe path). */
export async function transcribeWithGemini(
  audioBytes: Buffer,
  mimeType: string,
): Promise<SttResult | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) return null;

  const model = GEMINI_TRANSCRIBE_MODEL;
  const prompt =
    "Transcribe this Spanish audio exactly. Return only the transcript text, no punctuation labels.";

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
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || "audio/webm",
                    data: audioBytes.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 512, temperature: 0 },
        }),
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const transcript =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!transcript) return null;

    return { transcript, tier: "google-gemini-transcribe" };
  } catch {
    return null;
  }
}
