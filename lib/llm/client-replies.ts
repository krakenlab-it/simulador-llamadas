import type { ClientReaction } from "@/lib/scoring/rondas";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import { templateClientReply } from "@/lib/feedback/evaluation";

export interface GenerateReplyInput {
  config: ScenarioConfig;
  round: ScenarioRoundDef;
  reaction: ClientReaction;
  clientName: string;
  traineeUtterance: string;
  roundNumber: number;
}

function getLlmProvider(): "groq" | "gemini" | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GOOGLE_API_KEY) return "gemini";
  return null;
}

async function callGroq(prompt: string): Promise<string | null> {
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
        max_tokens: 120,
        temperature: 0.7,
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

async function callGemini(prompt: string): Promise<string | null> {
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
          generationConfig: { maxOutputTokens: 120, temperature: 0.7 },
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

function buildPrompt(input: GenerateReplyInput): string {
  const mood =
    input.reaction === "bien"
      ? "interesado pero exigente"
      : input.reaction === "medio"
        ? "escéptico, poco tiempo"
        : "frustrado, a punto de colgar";

  return `Eres ${input.clientName}, cliente en ${input.config.industry}.
Problema: ${input.config.clientProblem}.
Vendes/compras: ${input.config.productSold}.
Temperamento: ${input.config.temperament}.
Ronda: ${input.round.label}.
El vendedor dijo: "${input.traineeUtterance}".
Responde en 1-2 oraciones cortas, en el mismo idioma que el vendedor, tono ${mood}.
Solo la réplica del cliente, sin comillas ni explicación.`;
}

export async function generateClientReply(
  input: GenerateReplyInput,
): Promise<string> {
  const fallback = templateClientReply(
    input.config,
    input.round,
    input.reaction,
    input.clientName,
  );

  const provider = getLlmProvider();
  if (!provider) return fallback;

  const prompt = buildPrompt(input);
  const llmReply =
    provider === "groq" ? await callGroq(prompt) : await callGemini(prompt);

  if (!llmReply || llmReply.length < 8 || llmReply.length > 400) {
    return fallback;
  }

  return llmReply;
}

export function getOpeningLine(config: ScenarioConfig): string {
  return config.openingLines[0] ?? config.rounds[0]?.clientPrompt ?? "¿Quién habla?";
}

export function isLlmAvailable(): boolean {
  return getLlmProvider() !== null;
}
