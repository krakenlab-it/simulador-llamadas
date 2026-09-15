import { callLlm, getLlmEnvHint, isLlmAvailable } from "@/lib/llm/provider";
import { retrieveTopSnippets, checkReplyGrounding } from "./grounding";
import type { CharacterReplyInput, CharacterReplyResult } from "./types";

const RECENT_TURN_LIMIT = 8;

function reactionMood(reaction: CharacterReplyInput["reaction"]): string {
  if (reaction === "bien") return "algo más receptivo, pero aún con reservas";
  if (reaction === "medio") return "escéptico, con poco tiempo y poca paciencia";
  return "molesto o impaciente, a punto de colgar si no escucha valor concreto";
}

function formatRecentTurns(
  recentTurns: CharacterReplyInput["recentTurns"],
): string {
  const turns = recentTurns?.filter((turn) => turn.text.trim()) ?? [];
  if (turns.length === 0) {
    return "(La llamada acaba de empezar; acabas de contestar o estás por contestar.)";
  }
  return turns
    .slice(-RECENT_TURN_LIMIT)
    .map((turn) => {
      const speaker = turn.role === "trainee" ? "VENDEDOR" : "TÚ (CLIENTE)";
      return `${speaker}: ${turn.text.trim()}`;
    })
    .join("\n");
}

function clipUtterance(text: string, max = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function pickObjection(input: CharacterReplyInput): string {
  const pool = input.pack.objections.filter(Boolean);
  if (pool.length === 0) return "no veo el valor todavía";
  const seed = input.traineeUtterance.length + (input.recentTurns?.length ?? 0);
  return pool[seed % pool.length];
}

export function buildCharacterPrompt(input: CharacterReplyInput): string {
  const snippets = retrieveTopSnippets(input.pack, input.traineeUtterance, 8);
  const facts = input.pack.facts.slice(0, 10).join("; ");
  const objections = input.pack.objections.slice(0, 6).join("; ");
  const pains = input.pack.facts.slice(0, 4).join("; ") || input.pack.product;
  const companyLine = input.pack.companyContext
    ? `Empresa: ${input.pack.companyContext}.`
    : "";
  const titleLine = input.pack.clientTitle
    ? `Tu cargo: ${input.pack.clientTitle}.`
    : "";
  const recentThread = formatRecentTurns(input.recentTurns);

  return `Eres ${input.clientName}, el CLIENTE en una llamada en frío en vivo en México. No eres coach ni vendedor.

IDENTIDAD
- Nombre: ${input.clientName}
${companyLine}
${titleLine}
- Industria: ${input.pack.industry}
- Temperamento: ${input.pack.temperament}
- Dolores / KPIs que te importan: ${pains}
- Producto o servicio que te venden: ${input.pack.product}

CONVERSACIÓN HASTA AHORA (sigue este hilo; NUNCA ignores lo que el vendedor acaba de decir)
${recentThread}

ÚLTIMO MENSAJE DEL VENDEDOR (responde directamente a esto)
"${input.traineeUtterance.trim()}"

CONTEXTO DEL ESCENARIO
- Hechos permitidos: ${facts}
- Objeciones que puedes usar si encajan: ${objections}
- Criterio de éxito del vendedor: ${input.pack.winCriteria}
- Fragmentos anclados al pack:
${snippets.map((snippet) => `  • ${snippet}`).join("\n")}
- Prohibido afirmar: ${input.pack.forbiddenClaims.join("; ") || "nada fuera del pack"}

TONO Y ACTITUD
- Perfil emocional: ${input.tone.label} (intensidad ${input.tone.intensity}/3). ${input.tone.promptHint}
- Ronda actual: ${input.roundLabel}
- Cómo te sientes ahora con el vendedor: ${reactionMood(input.reaction)}

ESTILO (español mexicano ORAL, como en el teléfono)
- Habla como mexicano en el día a día: mire, oiga, ahorita, la neta, no manches, órale, ¿qué onda?, con todo respeto — solo cuando suene natural.
- Turnos cortos: 1 a 3 oraciones habladas. Sin acotaciones, sin comillas, sin "Cliente:".
- Puedes estar ocupado, confundido, escéptico o cortante; no eres amable de guion corporativo.
- Si el pitch es vago, pídele datos concretos o retoma tu objeción.
- Si propone día y hora concretos para avanzar, puedes aceptar con condiciones del pack.
- NUNCA inventes cifras, precios, nombres de empresas ni hechos que no estén en el pack.
- Mantente en el hilo: reacciona a lo que dijo el vendedor, no sueltes frases sueltas del banco.

SALIDA
Escribe ÚNICAMENTE la línea hablada del cliente, en español mexicano.`;
}

function buildGroundingRepairPrompt(input: CharacterReplyInput): string {
  return `${buildCharacterPrompt(input)}

Tu respuesta anterior no cumplió las reglas de anclaje (inventaste datos o saliste del pack).
Reescribe UNA sola línea del cliente usando SOLO hechos del pack y respondiendo a: "${input.traineeUtterance.trim()}".
Sin comillas, sin explicación, sin números ni nombres nuevos.`;
}

export function templateCharacterReply(input: CharacterReplyInput): string {
  const hook = clipUtterance(input.traineeUtterance);
  const objection = pickObjection(input);
  const shortHook = hook.length > 12 ? hook : "eso que me dice";

  if (input.reaction === "bien") {
    return `A ver, sobre lo de "${shortHook}"… ¿y eso en la práctica cómo me ayuda con ${objection.toLowerCase()}?`;
  }
  if (input.reaction === "medio") {
    return `Mire, ${objection}. No tengo mucho tiempo y lo de "${shortHook}" suena muy general.`;
  }
  if (hook.length > 20) {
    return `No manches, con lo de "${shortHook}" no me queda claro. ${objection}.`;
  }
  return `Oiga, no me interesa ahorita. ${objection}.`;
}

function sanitizeClientLine(raw: string): string {
  return raw
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/^(cliente|yo)\s*:\s*/i, "")
    .trim();
}

function isValidClientLine(line: string): boolean {
  return line.length >= 8 && line.length <= 400;
}

export async function generateCharacterReply(
  input: CharacterReplyInput,
): Promise<CharacterReplyResult> {
  const fallback = input.fallbackText || templateCharacterReply(input);

  if (!isLlmAvailable()) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  const prompt = buildCharacterPrompt(input);
  const llmReply = await callLlm(prompt, { maxTokens: 140, temperature: 0.72 });
  const cleaned = llmReply ? sanitizeClientLine(llmReply) : "";

  if (!isValidClientLine(cleaned)) {
    return { reply: fallback, grounded: true, usedLlm: false };
  }

  let grounding = checkReplyGrounding(cleaned, input.pack, input.clientName);
  if (grounding.ok) {
    return { reply: cleaned, grounded: true, usedLlm: true };
  }

  const repairReply = await callLlm(buildGroundingRepairPrompt(input), {
    maxTokens: 120,
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
