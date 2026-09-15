import { callLlm, getLlmEnvHint, isLlmAvailable } from "@/lib/llm/provider";
import { checkReplyGrounding } from "./grounding";
import {
  buildJaimeClientSystemPrompt,
  buildJaimeEvaluatorSystemPrompt,
  buildJaimeEvaluatorUserPrompt,
} from "./jaime-prompt";
import type { CharacterReplyInput, CharacterReplyResult, ScenarioPack } from "./types";

export const AGENTIC_LLM_UNAVAILABLE_REPLY =
  "[Capa agéntica] Falta GROQ_API_KEY o GOOGLE_API_KEY en el servidor. No se puede simular al cliente sin LLM. Configura una clave en Vercel Preview o Production.";

export const AGENTIC_LLM_GENERATION_FAILED_REPLY =
  "[Capa agéntica] No se pudo generar una respuesta válida del cliente con el LLM. Reintenta el turno o revisa la configuración del proveedor.";

const VOICE_WRITE_FORBIDDEN =
  /puede escribir|máximo un párrafo|mande un párrafo|por escrito ahora|envíe un pdf|mande un pdf|adjunte un pdf/i;

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
Sin comillas, sin explicación, sin números ni nombres nuevos. Empieza las oraciones con minúscula salvo nombres del pack.`;
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

function properNameTokens(pack: ScenarioPack, clientName: string): Set<string> {
  const corpus = [clientName, pack.companyContext, ...pack.facts].join(" ");
  const matches = corpus.match(/\b[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)*/g) ?? [];
  return new Set(matches.map((token) => token.toLowerCase()));
}

/** Motor mode: lowercase sentence starts except pack proper names. */
export function normalizeMotorClientLine(
  line: string,
  pack: ScenarioPack,
  clientName: string,
): string {
  const names = properNameTokens(pack, clientName);
  const startsWithName = (word: string): boolean => {
    const lower = word.toLowerCase();
    for (const name of names) {
      if (lower === name || lower.startsWith(`${name} `) || name.startsWith(`${lower} `)) {
        return true;
      }
    }
    return false;
  };

  const lowerFirst = (segment: string): string => {
    const trimmed = segment.trimStart();
    if (!trimmed) return segment;
    const leading = segment.slice(0, segment.indexOf(trimmed[0]));
    const firstWord = trimmed.split(/\s+/)[0] ?? "";
    if (startsWithName(firstWord)) return segment;
    return `${leading}${trimmed[0].toLowerCase()}${trimmed.slice(1)}`;
  };

  const parts = line.split(/(?<=[.!?…])\s+/);
  return parts.map(lowerFirst).join(" ").trim();
}

function stripClientModeLeaks(line: string): string {
  const finCall = /—\s*fin de la llamada\s*—/i;
  if (finCall.test(line)) {
    return line.split(finCall)[0].trim();
  }

  const evalStart =
    /(?:^|\n)\s*(Resultado|Puntaje|Por criterio|Evolución del cliente|Dos momentos clave|La objeción oculta|Lo que hizo bien|Tres prioridades|Recomendación)\s*:/i;
  const match = evalStart.exec(line);
  if (match?.index !== undefined && match.index >= 0) {
    return line.slice(0, match.index).trim();
  }

  return line.trim();
}

function sanitizeClientLine(
  raw: string,
  input: CharacterReplyInput,
  evaluatorMode = false,
): string {
  let line = raw
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/^(cliente|yo)\s*:\s*/i, "")
    .trim();

  if (!evaluatorMode) {
    line = stripClientModeLeaks(line);
    const meterLeak = /confianza\s*[:=]|inter[eé]s\s*[:=]|paciencia\s*[:=]|medidor/i;
    if (meterLeak.test(line)) {
      line = line.split("\n").find((part) => !meterLeak.test(part))?.trim() ?? line;
    }
    line = normalizeMotorClientLine(line, input.pack, input.clientName);
    if (input.channel === "voz" && VOICE_WRITE_FORBIDDEN.test(line)) {
      return "";
    }
  }

  return line;
}

function isValidClientLine(line: string, evaluatorMode = false): boolean {
  if (evaluatorMode) return line.length >= 40;
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return line.length >= 8 && line.length <= 400 && words >= 3;
}

function agenticFailureResult(reply: string): CharacterReplyResult {
  return { reply, grounded: false, usedLlm: false, agenticError: true };
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
  const agenticRequired = input.agenticRequired === true;

  if (input.forceEvaluator) {
    if (!isLlmAvailable()) {
      return {
        reply:
          "Resultado: no logrado — sin LLM no hay evaluación detallada.\nEscribe /reiniciar para practicar de nuevo.",
        grounded: true,
        usedLlm: false,
        evaluatorMode: true,
        agenticError: agenticRequired,
      };
    }
    const evaluation = await generateEvaluatorReply(input);
    const cleaned = evaluation ? sanitizeClientLine(evaluation, input, true) : "";
    if (isValidClientLine(cleaned, true)) {
      return { reply: cleaned, grounded: true, usedLlm: true, evaluatorMode: true };
    }
    return {
      reply:
        "Resultado: no logrado — no se pudo generar la evaluación completa.\nEscribe /reiniciar para practicar de nuevo.",
      grounded: true,
      usedLlm: false,
      evaluatorMode: true,
      agenticError: agenticRequired,
    };
  }

  if (!isLlmAvailable()) {
    if (agenticRequired) {
      return agenticFailureResult(`${AGENTIC_LLM_UNAVAILABLE_REPLY}\n\n${getLlmEnvHint()}`);
    }
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  const systemPrompt = buildCharacterPrompt(input);
  const llmReply = await callLlm(
    "Responde como el cliente en modo CLIENTE dentro del motor. Solo la línea hablada del cliente; no evalúes ni escribas fin de llamada.",
    { maxTokens: 180, temperature: 0.72, systemPrompt },
  );
  const cleaned = llmReply ? sanitizeClientLine(llmReply, input) : "";

  if (!isValidClientLine(cleaned)) {
    if (agenticRequired) {
      return agenticFailureResult(AGENTIC_LLM_GENERATION_FAILED_REPLY);
    }
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
  const repaired = repairReply ? sanitizeClientLine(repairReply, input) : "";
  if (isValidClientLine(repaired)) {
    grounding = checkReplyGrounding(repaired, input.pack, input.clientName);
    if (grounding.ok) {
      return { reply: repaired, grounded: true, usedLlm: true };
    }
  }

  if (agenticRequired) {
    return agenticFailureResult(AGENTIC_LLM_GENERATION_FAILED_REPLY);
  }
  return { reply: fallback, grounded: false, usedLlm: true };
}

/** Documented env vars for human-like agentic replies in preview/deploy. */
export function getCharacterReplyEnvHint(): string {
  return getLlmEnvHint();
}
