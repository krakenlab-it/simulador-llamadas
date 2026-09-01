import { callLlm, parseJsonFromLlm } from "@/lib/llm/provider";
import type { ScenarioConfig } from "@/lib/scenarios/types";
import {
  dimensionHundred,
  pickGapQuote,
  pickStrengthQuote,
  scoreTranscriptHeuristic,
} from "./heuristic-scorecard";
import { getDimensionLabel } from "./dimensions";
import { inferCallType, resolveWinCriteria, evaluateAdvanceOutcome } from "./outcome";
import type {
  BetterLineVariants,
  CallDebrief,
  CallOutcome,
  CallScorecard,
  DimensionScore,
  ScoreDimensionId,
  SessionScoreResult,
  TranscriptLine,
} from "./types";

export interface ScoreCallInput {
  lines: TranscriptLine[];
  config: ScenarioConfig | null;
  isPreset: boolean;
  previousDimensionScores?: Partial<Record<ScoreDimensionId, number>>;
}

interface LlmDimensionPayload {
  id: ScoreDimensionId;
  score: number;
  rationale: string;
  notApplicable?: boolean;
}

interface LlmScorePayload {
  dimensions: LlmDimensionPayload[];
  betterLines: BetterLineVariants;
  drill: string;
  strengthQuote: string;
  gapQuote: string;
  strengthDimension: ScoreDimensionId;
  gapDimension: ScoreDimensionId;
}

export async function scoreCall(input: ScoreCallInput): Promise<SessionScoreResult> {
  const heuristic = scoreTranscriptHeuristic({
    lines: input.lines,
    config: input.config,
    isPreset: input.isPreset,
  });

  const llm = await scoreWithLlm(input, heuristic);
  const scorecard = llm?.scorecard ?? heuristic;
  const debrief = buildDebrief({
    scorecard,
    lines: input.lines,
    config: input.config,
    llmExtras: llm?.extras,
    previousDimensionScores: input.previousDimensionScores,
  });

  const traineeText = input.lines
    .filter((l) => l.role === "trainee")
    .map((l) => l.text)
    .join("\n");
  const won = evaluateAdvanceOutcome(
    traineeText,
    resolveWinCriteria(input.config),
  );

  return { scorecard, debrief, won };
}

async function scoreWithLlm(
  input: ScoreCallInput,
  fallback: CallScorecard,
): Promise<{ scorecard: CallScorecard; extras: LlmScorePayload } | null> {
  const transcript = input.lines
    .map((l) => `${l.role === "trainee" ? "Vendedor" : "Cliente"}: ${l.text}`)
    .join("\n");

  const callType = inferCallType(input.config, input.isPreset);
  const winCriteria = resolveWinCriteria(input.config);

  const prompt = `Eres coach de ventas B2B en español (México). Evalúa la transcripción contra 6 dimensiones con escala anclada 1-5 (1=muy débil, 3=aceptable, 5=excelente).

Dimensiones y peso base:
- apertura_contrato (15%): presentación, permiso, contrato de llamada
- discovery_escucha (25%): preguntas abiertas, escucha activa
- dolor_implicacion (20%): explora dolor e implicación de negocio
- valor_tailor (15%): valor adaptado al contexto del cliente (NO jerga genérica tipo CPM/CTR/ROI salvo que el sector lo use)
- compostura_objecion (10%): si NO hubo objeción del cliente, marca notApplicable=true y NO regales 5
- cierre_siguiente_paso (15%): siguiente paso concreto

Overlay de tipo de llamada: ${callType}.
Criterio de éxito del escenario: ${winCriteria}.
NO evalúes conversión ni cierre de venta final.

Industria: ${input.config?.industry ?? "general"}.
Producto: ${input.config?.productSold ?? "N/A"}.
Problema del cliente: ${input.config?.clientProblem ?? "N/A"}.

Transcripción:
${transcript}

Responde SOLO JSON válido:
{
  "dimensions": [{"id":"apertura_contrato","score":3.5,"rationale":"...","notApplicable":false}],
  "strengthDimension": "discovery_escucha",
  "gapDimension": "cierre_siguiente_paso",
  "strengthQuote": "cita textual del vendedor",
  "gapQuote": "cita textual del vendedor",
  "betterLines": {"variantA":"reescritura en sus palabras","variantB":"otra variante"},
  "drill": "un drill concreto en español"
}`;

  const raw = await callLlm(prompt, { maxTokens: 900, temperature: 0.3 });
  if (!raw) return null;

  const parsed = parseJsonFromLlm<LlmScorePayload>(raw);
  if (!parsed?.dimensions?.length) return null;

  const dimensions: DimensionScore[] = parsed.dimensions.map((dim) => ({
    id: dim.id,
    label: getDimensionLabel(dim.id),
    score: clampStar(dim.score),
    rationale: dim.rationale,
    notApplicable: dim.notApplicable,
  }));

  const applicable = dimensions.filter((d) => !d.notApplicable);
  let weighted = 0;
  let totalWeight = 0;
  const weights: Record<ScoreDimensionId, number> = {
    apertura_contrato: 0.15,
    discovery_escucha: 0.25,
    dolor_implicacion: 0.2,
    valor_tailor: 0.15,
    compostura_objecion: 0.1,
    cierre_siguiente_paso: 0.15,
  };

  for (const dim of applicable) {
    const w = weights[dim.id] ?? 0.1;
    weighted += dimensionHundred(dim) * w;
    totalWeight += w;
  }

  const overallScore = totalWeight > 0 ? Math.round(weighted / totalWeight) : fallback.overallScore;
  const overallStars = Math.round((overallScore / 100) * 4 + 1);

  return {
    scorecard: {
      dimensions,
      overallScore,
      overallStars,
      callType,
      analytics: fallback.analytics,
    },
    extras: {
      ...parsed,
      dimensions: parsed.dimensions,
    },
  };
}

function clampStar(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score * 10) / 10));
}

function buildDebrief(input: {
  scorecard: CallScorecard;
  lines: TranscriptLine[];
  config: ScenarioConfig | null;
  llmExtras?: LlmScorePayload;
  previousDimensionScores?: Partial<Record<ScoreDimensionId, number>>;
}): CallDebrief {
  const traineeText = input.lines
    .filter((l) => l.role === "trainee")
    .map((l) => l.text)
    .join("\n");
  const won = evaluateAdvanceOutcome(
    traineeText,
    resolveWinCriteria(input.config),
  );
  const outcome: CallOutcome = won ? "advance" : "continuation";

  const applicable = input.scorecard.dimensions.filter((d) => !d.notApplicable);
  const sorted = [...applicable].sort((a, b) => a.score - b.score);
  const strongest = [...applicable].sort((a, b) => b.score - a.score)[0];
  const weakest = sorted[0];

  const strengthDim = input.llmExtras?.strengthDimension ?? strongest?.id ?? "discovery_escucha";
  const gapDim = input.llmExtras?.gapDimension ?? weakest?.id ?? "cierre_siguiente_paso";

  const lastTrainee = input.lines.filter((l) => l.role === "trainee").at(-1)?.text ?? "";

  const betterLines: BetterLineVariants = input.llmExtras?.betterLines ?? {
    variantA: rewriteLine(lastTrainee, gapDim),
    variantB: rewriteLine(lastTrainee, gapDim, true),
  };

  const dimensionTrend = input.scorecard.dimensions
    .filter((d) => !d.notApplicable)
    .map((dim) => {
      const current = dimensionHundred(dim);
      const previous = input.previousDimensionScores?.[dim.id] ?? null;
      let direction: "up" | "down" | "flat" = "flat";
      if (previous !== null) {
        if (current > previous + 3) direction = "up";
        else if (current < previous - 3) direction = "down";
      }
      return {
        dimensionId: dim.id,
        label: dim.label,
        current,
        previous,
        direction,
      };
    });

  return {
    outcome,
    outcomeLabel: outcome === "advance" ? "Advance" : "Continuation",
    strength: {
      dimension: getDimensionLabel(strengthDim),
      quote: input.llmExtras?.strengthQuote ?? pickStrengthQuote(input.lines),
    },
    primaryGap: {
      dimension: getDimensionLabel(gapDim),
      quote: input.llmExtras?.gapQuote ?? pickGapQuote(input.lines),
    },
    betterLines,
    drill:
      input.llmExtras?.drill ??
      `Drill: practica ${getDimensionLabel(gapDim).toLowerCase()} con una pregunta abierta y un siguiente paso con día y hora.`,
    dimensionTrend,
  };
}

function rewriteLine(
  original: string,
  gap: ScoreDimensionId,
  alternate = false,
): string {
  const trimmed = original.trim();
  if (!trimmed) {
    return alternate
      ? "¿Le parece si el jueves a las 10 revisamos juntos el impacto en su operación?"
      : "Antes de proponer nada, ¿qué le está costando más hoy este reto?";
  }

  const templates: Record<ScoreDimensionId, [string, string]> = {
    apertura_contrato: [
      `${trimmed.replace(/\.$/, "")} — ¿le robo dos minutos para ver si tiene sentido seguir?`,
      `${trimmed.replace(/\.$/, "")}. ¿Le parece si le cuento por qué llamo y usted me dice si vale la pena?`,
    ],
    discovery_escucha: [
      `${trimmed.replace(/\.$/, "")}. ¿Qué ha probado ya y qué resultado vio?`,
      `${trimmed.replace(/\.$/, "")}. Ayúdeme a entender: ¿qué le preocupa más de esto hoy?`,
    ],
    dolor_implicacion: [
      `${trimmed.replace(/\.$/, "")}. Si esto sigue igual tres meses, ¿qué impacto tendría en su equipo?`,
      `${trimmed.replace(/\.$/, "")}. ¿Qué le cuesta más hoy: tiempo, dinero o reputación?`,
    ],
    valor_tailor: [
      `${trimmed.replace(/\.$/, "")}, adaptado a cómo opera usted, no a un discurso genérico.`,
      `${trimmed.replace(/\.$/, "")}. En su caso concreto, el valor sería medir avance semana a semana.`,
    ],
    compostura_objecion: [
      `Entiendo su duda. ${trimmed.replace(/^./, (c) => c.toLowerCase())}`,
      `Tiene razón en ser cuidadoso. ${trimmed.replace(/^./, (c) => c.toLowerCase())}`,
    ],
    cierre_siguiente_paso: [
      `${trimmed.replace(/\.$/, "")}. ¿Le parece el martes a las 10:30 para definir el siguiente paso?`,
      `${trimmed.replace(/\.$/, "")}. ¿Le mando una propuesta breve y hablamos el jueves a las 9?`,
    ],
  };

  const pair = templates[gap];
  return alternate ? pair[1] : pair[0];
}

export { scoreTranscriptHeuristic };
