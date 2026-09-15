import { callLlm, getLlmEnvHint, isLlmAvailable } from "@/lib/llm/provider";
import { checkReplyGrounding } from "./grounding";
import {
  buildJaimeClientSystemPrompt,
  buildJaimeEvaluatorSystemPrompt,
  buildJaimeEvaluatorUserPrompt,
} from "./jaime-prompt";
import type { CharacterReplyInput, CharacterReplyResult } from "./types";

function pickObjection(input: CharacterReplyInput): string {
  const pool = input.pack.objections.filter(Boolean);
  if (pool.length === 0) return "no veo el valor todavía";
  const seed = input.traineeUtterance.length + (input.recentTurns?.length ?? 0);
  return pool[seed % pool.length];
}

export function buildCharacterPrompt(input: CharacterReplyInput): string {
  return buildJaimeClientSystemPrompt({
    pack: input.pack,
    config: input.config,
    clientName: input.clientName,
    channel: input.channel,
    difficultyLevel: input.difficultyLevel,
    maxTurns: input.maxTurns,
    recentTurns: input.recentTurns ?? [],
    traineeUtterance: input.traineeUtterance,
    meters: input.agenticState.meters,
    turnNumber: input.turnNumber,
    isCallEnding: input.isCallEnding,
  });
}

function buildGroundingRepairPrompt(input: CharacterReplyInput): string {
  return `${buildCharacterPrompt(input)}

Tu respuesta anterior no cumplió las reglas de anclaje (inventaste datos o saliste del pack).
Reescribe UNA sola línea del cliente usando SOLO hechos del pack y respondiendo a: "${input.traineeUtterance.trim()}".
Sin comillas, sin explicación, sin números ni nombres nuevos.`;
}

export function templateCharacterReply(input: CharacterReplyInput): string {
  const hook = input.traineeUtterance.trim().slice(0, 72);
  const objection = pickObjection(input);
  const shortHook = hook.length > 12 ? hook : "eso que me dice";

  if (input.channel === "voz") {
    if (input.reaction === "bien") {
      return `A ver, sobre lo de "${shortHook}"… ¿y eso en la práctica cómo me ayuda con ${objection.toLowerCase()}?`;
    }
    if (input.reaction === "medio") {
      return `Mire, ${objection}. No tengo mucho tiempo y lo de "${shortHook}" suena muy general.`;
    }
    return `Oiga, no me interesa ahorita. ${objection}.`;
  }

  if (input.reaction === "bien") {
    return `Sobre "${shortHook}": ¿me manda un resumen breve por mensaje? ${objection}.`;
  }
  return `Mire, ${objection}. Lo de "${shortHook}" suena general.`;
}

function sanitizeClientLine(raw: string, evaluatorMode = false): string {
  let line = raw
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/^(cliente|yo)\s*:\s*/i, "")
    .trim();

  if (!evaluatorMode) {
    const meterLeak = /confianza\s*[:=]|inter[eé]s\s*[:=]|paciencia\s*[:=]|medidor/i;
    if (meterLeak.test(line)) {
      line = line.split("\n").find((part) => !meterLeak.test(part))?.trim() ?? line;
    }
  }

  return line;
}

function isValidClientLine(line: string, evaluatorMode = false): boolean {
  if (evaluatorMode) return line.length >= 40;
  return line.length >= 8 && line.length <= 400;
}

async function generateEvaluatorReply(input: CharacterReplyInput): Promise<string | null> {
  const systemPrompt = buildJaimeEvaluatorSystemPrompt({
    pack: input.pack,
    config: input.config,
    clientName: input.clientName,
    channel: input.channel,
    difficultyLevel: input.difficultyLevel,
    maxTurns: input.maxTurns,
  });
  const userPrompt = buildJaimeEvaluatorUserPrompt(
    input.recentTurns ?? [],
    input.agenticState.meters,
  );

  return callLlm(userPrompt, {
    maxTokens: 900,
    temperature: 0.45,
    systemPrompt,
  });
}

export async function generateCharacterReply(
  input: CharacterReplyInput,
): Promise<CharacterReplyResult> {
  const fallback = input.fallbackText || templateCharacterReply(input);

  if (input.forceEvaluator) {
    if (!isLlmAvailable()) {
      return {
        reply:
          "Resultado: no logrado — sin LLM no hay evaluación detallada.\nEscribe /reiniciar para practicar de nuevo.",
        grounded: true,
        usedLlm: false,
        evaluatorMode: true,
      };
    }
    const evaluation = await generateEvaluatorReply(input);
    const cleaned = evaluation ? sanitizeClientLine(evaluation, true) : "";
    if (isValidClientLine(cleaned, true)) {
      return { reply: cleaned, grounded: true, usedLlm: true, evaluatorMode: true };
    }
    return {
      reply:
        "Resultado: no logrado — no se pudo generar la evaluación completa.\nEscribe /reiniciar para practicar de nuevo.",
      grounded: true,
      usedLlm: false,
      evaluatorMode: true,
    };
  }

  if (!isLlmAvailable()) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  const systemPrompt = buildCharacterPrompt(input);
  const llmReply = await callLlm(
    "Responde como el cliente en modo CLIENTE. Solo la línea hablada del cliente.",
    { maxTokens: 180, temperature: 0.72, systemPrompt },
  );
  const cleaned = llmReply ? sanitizeClientLine(llmReply) : "";

  if (!isValidClientLine(cleaned)) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  let grounding = checkReplyGrounding(cleaned, input.pack, input.clientName);
  if (grounding.ok) {
    return { reply: cleaned, grounded: true, usedLlm: true };
  }

  const repairReply = await callLlm(buildGroundingRepairPrompt(input), {
    maxTokens: 140,
    temperature: 0.35,
  });
  const repaired = repairReply ? sanitizeClientLine(repairReply) : "";
  if (isValidClientLine(repaired)) {
    grounding = checkReplyGrounding(repaired, input.pack, input.clientName);
    if (grounding.ok) {
      return { reply: repaired, grounded: true, usedLlm: true };
    }
  }

  return { reply: fallback, grounded: false, usedLlm: true };
}

/** Documented env vars for human-like agentic replies in preview/deploy. */
export function getCharacterReplyEnvHint(): string {
  return getLlmEnvHint();
}
