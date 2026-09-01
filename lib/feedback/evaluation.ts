import type { ClientReaction } from "@/lib/scoring/rondas";
import type {
  RichTurnFeedback,
  ScenarioConfig,
  ScenarioRoundDef,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";

export interface TurnForEvaluation {
  roundKey: string;
  roundLabel: string;
  roundScore: number;
  richFeedback?: RichTurnFeedback;
}

export interface HistoryScorePoint {
  totalScore: number | null;
  startedAt: string;
}

export function buildSessionEvaluation(
  turns: TurnForEvaluation[],
  won: boolean,
  config: ScenarioConfig | null,
  history: HistoryScorePoint[],
): SessionEvaluationSummary {
  if (turns.length === 0) {
    return {
      verdict: "No completaste ningún turno. Intenta de nuevo con un guion más corto.",
      strongestRound: { key: "—", label: "—", score: 0 },
      weakestRound: { key: "—", label: "—", score: 0 },
      nextDrill: "Practica la apertura: reconoce el problema del cliente en una frase.",
      trend: null,
    };
  }

  const sorted = [...turns].sort((a, b) => b.roundScore - a.roundScore);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const avgScore =
    turns.reduce((sum, t) => sum + t.roundScore, 0) / turns.length;

  const verdict = won
    ? `¡Excelente! Lograste el objetivo: ${config?.winCriteria ?? "cerrar con día y hora"}. Promedio ${avgScore.toFixed(0)}/100.`
    : `No alcanzaste el cierre. Promedio ${avgScore.toFixed(0)}/100 — refuerza ${weakest.roundLabel.toLowerCase()} (${weakest.roundScore} pts).`;

  const nextDrill = buildNextDrill(weakest, config);

  const completedHistory = history.filter((h) => h.totalScore !== null);
  const trend =
    completedHistory.length >= 2
      ? buildTrend(completedHistory)
      : completedHistory.length === 1
        ? {
            attempts: 1,
            averageScore: completedHistory[0].totalScore ?? avgScore,
            previousAverageScore: null,
            improving: false,
          }
        : null;

  return {
    verdict,
    strongestRound: {
      key: strongest.roundKey,
      label: strongest.roundLabel,
      score: strongest.roundScore,
    },
    weakestRound: {
      key: weakest.roundKey,
      label: weakest.roundLabel,
      score: weakest.roundScore,
    },
    nextDrill,
    trend,
  };
}

function buildNextDrill(
  weakest: TurnForEvaluation,
  config: ScenarioConfig | null,
): string {
  const round = config?.rounds.find((r) => r.key === weakest.roundKey);
  const goal = round?.goal ?? weakest.roundLabel;

  if (weakest.richFeedback?.missedCriteria.length) {
    return `Drill: en ${weakest.roundLabel}, practica incluir «${weakest.richFeedback.missedCriteria[0]}». Objetivo: ${goal}`;
  }

  return `Drill: repite ${weakest.roundLabel} 3 veces enfocándote en: ${goal}`;
}

function buildTrend(history: HistoryScorePoint[]): SessionEvaluationSummary["trend"] {
  const scores = history
    .map((h) => h.totalScore)
    .filter((s): s is number => s !== null);

  if (scores.length === 0) return null;

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const previousAverageScore =
    scores.length > 1
      ? scores.slice(0, -1).reduce((a, b) => a + b, 0) / (scores.length - 1)
      : null;

  return {
    attempts: scores.length,
    averageScore: Math.round(averageScore * 100) / 100,
    previousAverageScore:
      previousAverageScore !== null
        ? Math.round(previousAverageScore * 100) / 100
        : null,
    improving:
      previousAverageScore !== null ? averageScore > previousAverageScore : false,
  };
}

export function enrichClinicFeedback(input: {
  utterance: string;
  roundScore: number;
  roundLabel: string;
  roundGoal: string;
  keywordHits: Record<string, boolean>;
  missedCriteriaLabels: string[];
}): RichTurnFeedback {
  const hitLabels = Object.entries(input.keywordHits)
    .filter(([, hit]) => hit)
    .map(([key]) => key);

  let whyScore: string;
  if (input.roundScore >= 55) {
    whyScore = `Buena ronda: activaste ${hitLabels.slice(0, 3).join(", ") || "criterios clave"}.`;
  } else if (input.roundScore >= 30) {
    whyScore = `Respuesta aceptable pero incompleta. Faltó: ${input.missedCriteriaLabels.join(", ") || "más especificidad"}.`;
  } else {
    whyScore = `Por debajo del estándar. No cubriste ${input.missedCriteriaLabels.slice(0, 2).join(" ni ") || "los criterios de la ronda"}.`;
  }

  return {
    score: input.roundScore,
    utterance: input.utterance,
    whyScore,
    strongerLine: input.roundGoal,
    missedCriteria: input.missedCriteriaLabels,
    roundLabel: input.roundLabel,
  };
}

export function templateClientReply(
  config: ScenarioConfig,
  round: ScenarioRoundDef,
  reaction: ClientReaction,
  clientName: string,
): string {
  const templates: Record<ClientReaction, string> = {
    bien: `De acuerdo, ${clientName} escucha. Hable de ${config.clientProblem} con datos.`,
    medio: round.clientPrompt,
    mal: `No tengo tiempo. ${config.objections[0] ?? "Esto suena genérico."}`,
  };

  return templates[reaction];
}
