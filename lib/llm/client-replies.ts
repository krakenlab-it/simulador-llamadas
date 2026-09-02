import type { ClientReaction } from "@/lib/scoring/rondas";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import { templateClientReply } from "@/lib/feedback/evaluation";
import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import {
  buildLanguageLockSystemPrompt,
  resolveScenarioLanguage,
} from "@/lib/scenarios/language";
import { phaseKeyFromPersistenceKey } from "@/lib/simulation/round-keys";

/** Max wait for Groq preset client replies before scripted fallback. */
export const GROQ_CLIENT_REPLY_TIMEOUT_MS = 8_000;

export interface GenerateReplyInput {
  config: ScenarioConfig;
  round: ScenarioRoundDef;
  reaction: ClientReaction;
  clientName: string;
  traineeUtterance: string;
  roundNumber: number;
}

async function callGroq(
  prompt: string,
  signal: AbortSignal | undefined,
  systemPrompt: string,
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
      signal,
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
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

export function buildClientReplyPrompt(input: GenerateReplyInput): string {
  const language = resolveScenarioLanguage(input.config);
  const mood =
    input.reaction === "bien"
      ? "interesado pero exigente"
      : input.reaction === "medio"
        ? "escéptico, poco tiempo"
        : "frustrado, a punto de colgar";

  const phaseKey = phaseKeyFromPersistenceKey(input.round.key);
  const turnLabel =
    input.roundNumber >= 5 || phaseKey === "cierre"
      ? `Estás en ${input.round.label} (turno ${input.roundNumber || phaseKey}). Sigue en ${language.promptName} hasta colgar.`
      : `Ronda: ${input.round.label}.`;
  const goodLooksLike = input.round.whatGoodLooksLike?.trim();

  return `Eres ${input.clientName}, cliente en ${input.config.industry}.
Problema: ${input.config.clientProblem}.
Vendes/compras: ${input.config.productSold}.
Temperamento: ${input.config.temperament}.
Idioma obligatorio: ${language.promptName} (${language.iso639}). Habla SOLO en ${language.promptName}.
${turnLabel}
${goodLooksLike ? `En esta fase, una buena respuesta del vendedor se ve así: ${goodLooksLike}.` : ""}
El vendedor dijo: "${input.traineeUtterance}".
Responde en 1-2 oraciones cortas, tono ${mood}.
Solo la réplica del cliente, sin comillas ni explicación.`;
}

export function isGroqAvailable(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

/** Preset clinic replies: Groq only, with timeout → scripted fallback. */
export async function generateGroqClientReply(
  input: GenerateReplyInput,
  fallbackText: string,
): Promise<string> {
  if (!isGroqAvailable()) return fallbackText;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GROQ_CLIENT_REPLY_TIMEOUT_MS,
  );

  try {
    const language = resolveScenarioLanguage(input.config);
    const prompt = buildClientReplyPrompt(input);
    const llmReply = await callGroq(
      prompt,
      controller.signal,
      buildLanguageLockSystemPrompt(language),
    );
    if (!llmReply || llmReply.length < 8 || llmReply.length > 400) {
      return fallbackText;
    }
    return llmReply;
  } catch {
    return fallbackText;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateClientReply(
  input: GenerateReplyInput,
  fallbackText?: string,
): Promise<string> {
  const fallback =
    fallbackText ??
    templateClientReply(
      input.config,
      input.round,
      input.reaction,
      input.clientName,
    );

  if (!isLlmAvailable()) return fallback;

  const language = resolveScenarioLanguage(input.config);
  const prompt = `${buildLanguageLockSystemPrompt(language)}\n\n${buildClientReplyPrompt(input)}`;
  const llmReply = await callLlm(prompt, { maxTokens: 120, temperature: 0.7 });

  if (!llmReply || llmReply.length < 8 || llmReply.length > 400) {
    return fallback;
  }

  return llmReply;
}

export function getOpeningLine(config: ScenarioConfig): string {
  return config.openingLines[0] ?? config.rounds[0]?.clientPrompt ?? "¿Quién habla?";
}

export { isLlmAvailable } from "@/lib/llm/provider";
