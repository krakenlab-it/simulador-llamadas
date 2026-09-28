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
import {
  acknowledgeOfferedSlot,
  analyzeMeetingLogistics,
} from "@/lib/agent/client-motor";
import {
  buildBuyerHarnessContextBlocks,
  enforceHarnessNoRepeat,
} from "@/lib/agent/dialogue-memory";
import { generateImpersonatedReply } from "@/lib/agent/impersonation";
import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";
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
  scenarioSlug?: string;
  priorTurns?: ConversationTurn[];
  difficultyLevel?: DifficultyLevel;
  mode?: PracticeMode;
  clientLayer?: ClientLayerSettings;
}

async function callGroq(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  signal: AbortSignal | undefined,
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
        messages,
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

  const harness =
    input.priorTurns && input.priorTurns.length > 0
      ? buildBuyerHarnessContextBlocks({
          priorTurns: input.priorTurns,
          recentClientReplies: input.priorTurns
            .filter((turn) => turn.role === "client")
            .map((turn) => turn.text),
          psych: analyzeBuyerPsych({
            traineeUtterance: input.traineeUtterance,
            priorTurns: input.priorTurns,
            roundNumber: input.roundNumber,
            scenarioSlug: input.scenarioSlug,
            pack: buyerPsychPackForScenario({
              scenarioSlug: input.scenarioSlug,
              config: input.config,
              clientName: input.clientName,
              difficultyLevel: input.difficultyLevel,
              mode: input.mode,
            }),
          }),
          logistics: analyzeMeetingLogistics(
            input.priorTurns,
            input.traineeUtterance,
          ),
          roundNumber: input.roundNumber,
        })
      : "";

  return `Eres ${input.clientName}, cliente en ${input.config.industry}.
Problema: ${input.config.clientProblem}.
Vendes/compras: ${input.config.productSold}.
Temperamento: ${input.config.temperament}.
Idioma obligatorio: ${language.promptName} (${language.iso639}). Habla SOLO en ${language.promptName}.
${turnLabel}
${goodLooksLike ? `En esta fase, una buena respuesta del vendedor se ve así: ${goodLooksLike}.` : ""}
${harness ? `${harness}\n\n` : ""}El vendedor dijo ahora: "${input.traineeUtterance}".
Responde en 1-2 oraciones cortas, tono ${mood}. No repitas una réplica que ya dijiste en el transcript.
${questionHint}
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
    const systemPrompt = buildLanguageLockSystemPrompt(language);
    const groqMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];
    for (const turn of input.priorTurns ?? []) {
      if (turn.role === "trainee") {
        groqMessages.push({
          role: "user",
          content: `El vendedor dijo: "${turn.text.trim()}"`,
        });
      } else {
        groqMessages.push({ role: "assistant", content: turn.text.trim() });
      }
    }
    groqMessages.push({ role: "user", content: prompt });
    const llmReply = await callGroq(groqMessages, controller.signal);
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
  const psych = analyzeBuyerPsych({
    traineeUtterance: input.traineeUtterance,
    priorTurns: input.priorTurns,
    roundNumber: input.roundNumber,
    scenarioSlug: input.scenarioSlug,
    pack: buyerPsychPackForScenario({
      scenarioSlug: input.scenarioSlug,
      config: input.config,
      clientName: input.clientName,
      difficultyLevel: input.difficultyLevel,
      mode: input.mode,
    }),
  });
  const logistics = analyzeMeetingLogistics(
    input.priorTurns ?? [],
    input.traineeUtterance,
  );
  const recentClientReplies = (input.priorTurns ?? [])
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.text);
  const policed = enforceBuyerTurnPolicy(
    reply,
    psych,
    input.traineeUtterance,
    recentClientReplies,
  );
  let fallback = templateClientReply(
    input.config,
    input.round,
    input.reaction,
    input.clientName,
  );
  if (logistics.shouldAcknowledgeSlot) {
    const rememberedSlot = psych.offeredSlot ?? input.traineeUtterance;
    fallback = acknowledgeOfferedSlot(rememberedSlot, input.roundNumber);
  }
  return enforceHarnessNoRepeat({
    candidate: policed,
    recentClientReplies,
    phase: psych.phase,
    primaryFallback: fallback,
    turnNumber: input.roundNumber,
  });
}

export function getOpeningLine(config: ScenarioConfig): string {
  return config.openingLines[0] ?? config.rounds[0]?.clientPrompt ?? "¿Quién habla?";
}

export { isLlmAvailable } from "@/lib/llm/provider";
