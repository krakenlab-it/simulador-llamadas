import {
  analyzeBuyerPsych,
  enforceBuyerTurnPolicy,
} from "@/lib/agent/buyer-psych";
import type { ClientLayerSettings } from "@/lib/agent/client-layer";
import type { ConversationTurn } from "@/lib/agent/client-motor";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import type { ClientReaction } from "@/lib/scoring/rondas";
import type { ScenarioConfig, ScenarioRoundDef } from "@/lib/scenarios/types";
import { templateClientReply } from "@/lib/feedback/evaluation";
import { isDeepSeekAvailable } from "@/lib/agent/availability";
import { buyerPsychPackForScenario } from "@/lib/agent/client-pack";
import { generateImpersonatedReply } from "@/lib/agent/impersonation";
import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
import {
  buildLanguageLockSystemPrompt,
  resolveScenarioLanguage,
} from "@/lib/scenarios/language";
import { sanitizeLeakedBuyerReply } from "@/lib/scenarios/authoring-leak";
import { phaseKeyFromPersistenceKey } from "@/lib/simulation/round-keys";
import { formatTranscriptBlock } from "@/lib/agent/buyer-transcript";

/** Max wait for Groq preset client replies before scripted fallback. */
export const GROQ_CLIENT_REPLY_TIMEOUT_MS = 8_000;

export interface GenerateReplyInput {
  config: ScenarioConfig;
  round: ScenarioRoundDef;
  reaction: ClientReaction;
  clientName: string;
  traineeUtterance: string;
  roundNumber: number;
  scenarioSlug?: string;
  priorTurns?: ConversationTurn[];
  difficultyLevel?: DifficultyLevel;
  difficultyLabel?: string | null;
  mode?: PracticeMode;
  clientLayer?: ClientLayerSettings;
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

  const preset = input.scenarioSlug
    ? getCatalogPreset(input.scenarioSlug)
    : undefined;
  const questionHint = preset?.questionBank[0]
    ? `Si preguntas, usa un ángulo de este cliente: ${preset.questionBank[0]} No copies las réplicas de otros clientes.`
    : "No repitas la misma pregunta. Cambia el ángulo.";

  const prior = input.priorTurns ?? [];
  const transcript =
    prior.length > 0
      ? `\nTranscript hasta ahora:\n${formatTranscriptBlock(prior, input.traineeUtterance)}\n`
      : "";

  return `Eres ${input.clientName}, cliente en ${input.config.industry}.
Contexto interno (NUNCA lo copies palabra por palabra): problema del negocio, objeciones y fases son briefing del coach.
Temperamento: ${input.config.temperament}.
Idioma obligatorio: ${language.promptName} (${language.iso639}). Habla SOLO en ${language.promptName}.
${turnLabel}
${goodLooksLike ? `En esta fase, una buena respuesta del vendedor se ve así: ${goodLooksLike}.` : ""}
${transcript}Responde al ÚLTIMO turno del vendedor en 1-2 oraciones cortas, tono ${mood}, como persona real al teléfono.
Si ya te presentaron, NO vuelvas a preguntar quién habla.
${questionHint}
PROHIBIDO pegar texto del perfil (problema real, metas de fase, banco de objeciones). Solo la réplica del cliente, sin comillas ni explicación.`;
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
    return policeClientReply(input, llmReply);
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

  if (input.clientLayer?.motorEnabled === false) {
    return fallback;
  }

  if (isDeepSeekAvailable()) {
    return generateImpersonatedReply(input, fallback);
  }

  if (!isLlmAvailable()) return fallback;

  const language = resolveScenarioLanguage(input.config);
  const prompt = `${buildLanguageLockSystemPrompt(language)}\n\n${buildClientReplyPrompt(input)}`;
  const llmReply = await callLlm(prompt, { maxTokens: 120, temperature: 0.7 });

  if (!llmReply || llmReply.length < 8 || llmReply.length > 400) {
    return fallback;
  }

  return policeClientReply(input, llmReply);
}

function policeClientReply(input: GenerateReplyInput, reply: string): string {
  const recentReplies = (input.priorTurns ?? [])
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.text);
  const psych = analyzeBuyerPsych({
    traineeUtterance: input.traineeUtterance,
    priorTurns: input.priorTurns,
    roundNumber: input.roundNumber,
    scenarioSlug: input.scenarioSlug,
    difficultyLevel: input.difficultyLevel,
    pack: buyerPsychPackForScenario({
      scenarioSlug: input.scenarioSlug,
      config: input.config,
      clientName: input.clientName,
      difficultyLevel: input.difficultyLevel,
      difficultyLabel: input.difficultyLabel,
      mode: input.mode,
    }),
  });
  const language = input.config.language === "en" ? "en" : "es";
  const leakSafe = sanitizeLeakedBuyerReply(reply, input.config, language);
  return enforceBuyerTurnPolicy(
    leakSafe,
    psych,
    input.traineeUtterance,
    recentReplies,
  );
}

export function getOpeningLine(config: ScenarioConfig): string {
  const stored = config.openingLines[0]?.trim();
  if (stored) return stored;
  const language = config.language ?? "es";
  return language === "en" ? "Hello, who's calling?" : "¿Quién habla?";
}

export { isLlmAvailable } from "@/lib/llm/provider";
