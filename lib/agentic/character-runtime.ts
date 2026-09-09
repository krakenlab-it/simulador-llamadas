import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import { retrieveTopSnippets, checkReplyGrounding } from "./grounding";
import type { CharacterReplyInput, CharacterReplyResult } from "./types";

function reactionMood(reaction: CharacterReplyInput["reaction"]): string {
  if (reaction === "bien") return "algo más receptivo";
  if (reaction === "medio") return "escéptico, con poco tiempo";
  return "molesto, a punto de colgar";
}

export function buildCharacterPrompt(input: CharacterReplyInput): string {
  const snippets = retrieveTopSnippets(input.pack, input.traineeUtterance, 3);
  const facts = input.pack.facts.slice(0, 5).join("; ");
  const objections = input.pack.objections.slice(0, 3).join("; ");

  return `Eres ${input.clientName}, cliente real en una simulación de ventas.
Producto/servicio en juego: ${input.pack.product}.
Problema: ${facts}.
Objeciones posibles: ${objections}.
Criterio de éxito del vendedor: ${input.pack.winCriteria}.
Tono emocional: ${input.tone.label} (intensidad ${input.tone.intensity}/3). ${input.tone.promptHint}
Ronda: ${input.roundLabel}. Estado: ${reactionMood(input.reaction)}.
Hechos permitidos (NO inventes cifras, precios ni nombres fuera de esto):
${snippets.map((snippet) => `- ${snippet}`).join("\n")}
Prohibido afirmar: ${input.pack.forbiddenClaims.join("; ")}.
El vendedor dijo: "${input.traineeUtterance}".
Responde en 1-2 oraciones cortas en español, solo como cliente, sin comillas ni explicación.`;
}

function templateCharacterReply(input: CharacterReplyInput): string {
  const objection = input.pack.objections[0] ?? "necesito más información";
  if (input.reaction === "bien") {
    return `Entiendo. Sobre ${input.pack.product}, ¿cómo encaja con ${objection.toLowerCase()}?`;
  }
  if (input.reaction === "medio") {
    return `Mire, ${objection}. No tengo mucho tiempo.`;
  }
  return `No me interesa ahora. ${objection}.`;
}

export async function generateCharacterReply(
  input: CharacterReplyInput,
): Promise<CharacterReplyResult> {
  const fallback = input.fallbackText || templateCharacterReply(input);

  if (!isLlmAvailable()) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  const prompt = buildCharacterPrompt(input);
  const llmReply = await callLlm(prompt, { maxTokens: 120, temperature: 0.65 });

  if (!llmReply || llmReply.length < 8 || llmReply.length > 400) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  const grounding = checkReplyGrounding(llmReply, input.pack, input.clientName);
  if (!grounding.ok) {
    return { reply: fallback, grounded: false, usedLlm: true };
  }

  return { reply: llmReply, grounded: true, usedLlm: true };
}
