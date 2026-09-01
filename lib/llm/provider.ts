export type LlmProvider = "groq" | "gemini";

export function getLlmProvider(): LlmProvider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GOOGLE_API_KEY) return "gemini";
  return null;
}

export function isLlmAvailable(): boolean {
  return getLlmProvider() !== null;
}

export async function callLlm(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const provider = getLlmProvider();
  if (!provider) return null;

  const maxTokens = options.maxTokens ?? 800;
  const temperature = options.temperature ?? 0.4;

  if (provider === "groq") {
    return callGroq(prompt, maxTokens, temperature);
  }
  return callGemini(prompt, maxTokens, temperature);
}

async function callGroq(
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function callGemini(
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      },
    );

    if (!response.ok) return null;
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

export function parseJsonFromLlm<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
