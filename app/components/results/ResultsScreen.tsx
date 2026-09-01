"use client";

import type { EndSessionResponse, TurnSummary } from "@/lib/api/client";
import { computeLocalTrend } from "@/lib/history/local";
import { Button } from "@/app/components/ui/Button";
import { Spinner } from "@/app/components/ui/Spinner";

interface ResultsScreenProps {
  result: EndSessionResponse | null;
  turns: TurnSummary[];
  clientName: string;
  scenarioSlug: string;
  totalRounds: number;
  loading?: boolean;
  onRepeat: () => void;
  onNewScenario: () => void;
  onViewHistory: () => void;
}

export function ResultsScreen({
  result,
  turns,
  clientName,
  scenarioSlug,
  totalRounds,
  loading = false,
  onRepeat,
  onNewScenario,
  onViewHistory,
}: ResultsScreenProps) {
  if (loading || !result) {
    return (
      <div className="results-screen results-screen--loading">
        <Spinner label="Generando tu evaluación y coaching…" size="lg" />
      </div>
    );
  }

  const { evaluation } = result;
  const localTrend = computeLocalTrend(scenarioSlug);
  const trend =
    evaluation.trend && evaluation.trend.attempts > 1
      ? evaluation.trend
      : localTrend && localTrend.attempts > 1
        ? localTrend
        : null;

  return (
    <section className="results-screen" aria-label="Resultados de la llamada">
      <header className="results-hero">
        <p className="results-hero__eyebrow">Evaluación completada</p>
        <h1 className={`results-hero__title ${result.won ? "results-hero__title--won" : ""}`}>
          {result.won ? "¡Objetivo logrado!" : "Sigue practicando"}
        </h1>
        <p className="results-hero__verdict">{evaluation.verdict}</p>
        <div className="results-hero__score">
          <span className="results-hero__score-value">{result.totalScore}</span>
          <span className="results-hero__score-label">/100 promedio</span>
        </div>
        <p className="results-hero__meta">
          {turns.length}/{totalRounds} rondas · con {clientName}
        </p>
      </header>

      <div className="results-grid">
        <article className="insight-card insight-card--positive">
          <h2 className="insight-card__title">Mejor ronda</h2>
          <p className="insight-card__value">
            {evaluation.strongestRound.label}
          </p>
          <p className="insight-card__detail">
            {evaluation.strongestRound.score}/100
          </p>
        </article>
        <article className="insight-card insight-card--focus">
          <h2 className="insight-card__title">A reforzar</h2>
          <p className="insight-card__value">
            {evaluation.weakestRound.label}
          </p>
          <p className="insight-card__detail">
            {evaluation.weakestRound.score}/100
          </p>
        </article>
      </div>

      <article className="coaching-panel">
        <h2 className="coaching-panel__title">Tu próximo drill</h2>
        <p className="coaching-panel__body">{evaluation.nextDrill}</p>
      </article>

      {trend ? (
        <article className="trend-panel">
          <h2 className="trend-panel__title">
            Tendencia · {trend.attempts} intentos
          </h2>
          <p className="trend-panel__body">
            Promedio histórico: {trend.averageScore.toFixed(0)}/100
            {trend.improving ? " · Vas mejorando" : " · Estable"}
          </p>
        </article>
      ) : null}

      <section className="round-breakdown" aria-labelledby="round-breakdown-title">
        <h2 id="round-breakdown-title" className="round-breakdown__title">
          Detalle por ronda
        </h2>
        {turns.length === 0 ? (
          <p className="round-breakdown__empty">
            Colgaste antes de completar turnos. Intenta de nuevo con el mismo
            escenario.
          </p>
        ) : (
          <ul className="round-breakdown__list">
            {turns.map((turn) => (
              <li key={turn.roundKey} className="round-breakdown__item">
                <div className="round-breakdown__head">
                  <strong>{turn.roundLabel}</strong>
                  <span>{turn.roundScore} pts</span>
                </div>
                <p>{turn.richFeedback.whyScore}</p>
                <p className="round-breakdown__quote">
                  Dijiste: &ldquo;{turn.utterance}&rdquo;
                </p>
                <p className="round-breakdown__stronger">
                  Línea más fuerte: <em>{turn.richFeedback.strongerLine}</em>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="results-actions">
        <Button variant="primary" size="lg" onClick={onRepeat}>
          Repetir con {clientName}
        </Button>
        <Button variant="secondary" onClick={onNewScenario}>
          Otro escenario
        </Button>
        <Button variant="ghost" onClick={onViewHistory}>
          Ver historial
        </Button>
      </div>
    </section>
  );
}
