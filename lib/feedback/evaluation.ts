import type { ClientReaction } from "@/lib/scoring/rondas";
import type {
  RichTurnFeedback,
  ScenarioConfig,
  ScenarioRoundDef,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";
import type { SessionScoreResult } from "@/lib/scoring/types";
import { resolveWinCriteria } from "@/lib/scoring/outcome";

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
  sessionScore?: SessionScoreResult,
): SessionEvaluationSummary {
  const scorecard = sessionScore?.scorecard;
  const debrief = sessionScore?.debrief;
  const winLabel = resolveWinCriteria(config);

  if (turns.length === 0) {
    return {
      verdict: "No completaste ningún turno. Intenta de nuevo con un guion más corto.",
      strongestRound: { key: "—", label: "—", score: 0 },
      weakestRound: { key: "—", label: "—", score: 0 },
      nextDrill: "Practica la apertura: reconoce el problema del cliente en una frase.",
      trend: null,
      scorecard,
      debrief,
    };
  }

  const sorted = [...turns].sort((a, b) => b.roundScore - a.roundScore);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const overall = scorecard?.overallScore ?? Math.round(
    turns.reduce((sum, t) => sum + t.roundScore, 0) / turns.length,
  );

  const outcomeLabel = debrief?.outcomeLabel ?? (won ? "Advance" : "Continuation");
  const verdict = won
    ? `¡Advance! Lograste el objetivo: ${winLabel}. Scorecard ${overall}/100 (${scorecard?.overallStars ?? "—"}/5).`
    : `${outcomeLabel}: no alcanzaste ${winLabel}. Scorecard ${overall}/100 — refuerza ${debrief?.primaryGap.dimension ?? weakest.roundLabel}.`;

  const nextDrill =
    debrief?.drill ??
    buildNextDrill(weakest, config);

  const completedHistory = history.filter((h) => h.totalScore !== null);
  const trend =
    completedHistory.length >= 2
      ? buildTrend(completedHistory)
      : completedHistory.length === 1
        ? {
            attempts: 1,
            averageScore: completedHistory[0].totalScore ?? overall,
            previousAverageScore: null,
            improving: false,
            showStableLabel: false,
          }
        : null;

  return {
    verdict,
    strongestRound: {
      key: strongest.roundKey,
      label: debrief?.strength.dimension ?? strongest.roundLabel,
      score: scorecard
        ? scorecard.dimensions.find((d) => d.label === debrief?.strength.dimension)?.score ??
          strongest.roundScore
        : strongest.roundScore,
    },
    weakestRound: {
      key: weakest.roundKey,
      label: debrief?.primaryGap.dimension ?? weakest.roundLabel,
      score: weakest.roundScore,
    },
    nextDrill,
    trend,
    scorecard,
    debrief,
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

  const improving =
    previousAverageScore !== null ? averageScore > previousAverageScore : false;
  const regressing =
    previousAverageScore !== null ? averageScore < previousAverageScore : false;

  return {
    attempts: scores.length,
    averageScore: Math.round(averageScore * 100) / 100,
    previousAverageScore:
      previousAverageScore !== null
        ? Math.round(previousAverageScore * 100) / 100
        : null,
    improving,
    showStableLabel: !improving && !regressing,
  };
}

export function enrichClinicFeedback(input: {
  utterance: string;
  roundScore: number;
  roundLabel: string;
  roundGoal: string;
  coachingNote: string;
}): RichTurnFeedback {
  return {
    score: input.roundScore,
    utterance: input.utterance,
    whyScore: input.coachingNote,
    strongerLine: input.coachingNote,
    missedCriteria: [],
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
