"use client";

import type { EndSessionResponse, TurnSummary } from "@/lib/api/client";
import { computeLocalTrend } from "@/lib/history/local";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Spinner } from "@/app/components/ui/Spinner";
import { AnalyticsChips } from "@/app/components/call/AnalyticsChips";

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
  historyActionLabel?: string;
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
  historyActionLabel = "Ver historial",
}: ResultsScreenProps) {
  if (loading) {
    return (
      <div className="results-screen results-screen--loading">
        <Spinner label="Generando tu evaluación y coaching…" size="lg" />
      </div>
    );
  }

  if (!result) {
    return (
      <section className="results-screen" aria-label="Evaluación no disponible">
        <EmptyState
          title="No se pudo generar la evaluación"
          description="La llamada se colgó, pero el scorecard no se guardó. Puedes repetir el mismo caso o elegir otro escenario."
        />
        <div className="results-actions">
          <Button variant="primary" size="lg" onClick={onRepeat}>
            Repetir con {clientName}
          </Button>
          <Button variant="secondary" onClick={onNewScenario}>
            Otro escenario
          </Button>
          <Button variant="ghost" onClick={onViewHistory}>
            {historyActionLabel}
          </Button>
        </div>
      </section>
    );
  }

  const { evaluation } = result;
  const scorecard = evaluation.scorecard;
  const debrief = evaluation.debrief;
  const localTrend = computeLocalTrend(scenarioSlug);
  const trend =
    evaluation.trend && evaluation.trend.attempts > 1
      ? evaluation.trend
      : localTrend && localTrend.attempts > 1
        ? localTrend
        : null;

  const trendLabel = trend
    ? trend.improving
      ? " · Vas mejorando"
      : trend.showStableLabel === false && !trend.improving
        ? " · Necesitas refuerzo"
        : trend.showStableLabel !== false && !trend.improving
          ? ""
          : ""
    : "";

  return (
    <section className="results-screen" aria-label="Resultados de la llamada">
      <header className="results-hero">
        <p className="results-hero__eyebrow">Evaluación completada</p>
        <h1 className={`results-hero__title ${result.won ? "results-hero__title--won" : ""}`}>
          {debrief?.outcomeLabel === "Advance" || result.won
            ? "¡Advance logrado!"
            : "Continuation — sigue practicando"}
        </h1>
        <p className="results-hero__verdict">{evaluation.verdict}</p>
        <div className="results-hero__score">
          <span className="results-hero__score-value">
            {scorecard?.overallScore ?? result.totalScore}
          </span>
          <span className="results-hero__score-label">
            /100 · {scorecard?.overallStars ?? "—"}/5 estrellas
          </span>
        </div>
        <p className="results-hero__meta">
          {turns.length}/{totalRounds} rondas · con {clientName}
        </p>
      </header>

      {scorecard ? (
        <section className="scorecard-panel" aria-labelledby="scorecard-title">
          <h2 id="scorecard-title" className="scorecard-panel__title">
            Scorecard · overlay {scorecard.callType}
          </h2>
          <ul className="scorecard-panel__list">
            {scorecard.dimensions
              .filter((dim) => !dim.notApplicable)
              .map((dim) => (
                <li key={dim.id} className="scorecard-panel__item">
                  <div className="scorecard-panel__head">
                    <strong>{dim.label}</strong>
                    <span>{dim.score}/5</span>
                  </div>
                  <p>{dim.rationale}</p>
                </li>
              ))}
          </ul>
          <AnalyticsChips analytics={scorecard.analytics} />
        </section>
      ) : null}

      {debrief ? (
        <article className="debrief-panel">
          <h2 className="debrief-panel__title">Debrief en una habilidad</h2>
          <p className="debrief-panel__outcome">
            Resultado: <strong>{debrief.outcomeLabel}</strong>
          </p>
          <p>
            <strong>Fortaleza ({debrief.strength.dimension}):</strong> &ldquo;
            {debrief.strength.quote}&rdquo;
          </p>
          <p>
            <strong>Brecha ({debrief.primaryGap.dimension}):</strong> &ldquo;
            {debrief.primaryGap.quote}&rdquo;
          </p>
          <div className="debrief-panel__lines">
            <p>
              <strong>Mejor línea (variante A):</strong>{" "}
              <em>{debrief.betterLines.variantA}</em>
            </p>
            <p>
              <strong>Mejor línea (variante B):</strong>{" "}
              <em>{debrief.betterLines.variantB}</em>
            </p>
          </div>
          <p className="debrief-panel__drill">
            <strong>Drill:</strong> {debrief.drill}
          </p>
          {debrief.dimensionTrend.length > 0 ? (
            <div className="dimension-sparkline" aria-label="Tendencia por dimensión">
              {debrief.dimensionTrend.map((point) => (
                <div key={point.dimensionId} className="dimension-sparkline__item">
                  <span className="dimension-sparkline__label">{point.label}</span>
                  <span
                    className={`dimension-sparkline__bar dimension-sparkline__bar--${point.direction}`}
                    style={{ width: `${point.current}%` }}
                  />
                  <span className="dimension-sparkline__value">{point.current}</span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <div className="results-grid">
        <article className="insight-card insight-card--positive">
          <h2 className="insight-card__title">Mejor dimensión</h2>
          <p className="insight-card__value">
            {evaluation.strongestRound.label}
          </p>
          <p className="insight-card__detail">
            {evaluation.strongestRound.score}/5
          </p>
        </article>
        <article className="insight-card insight-card--focus">
          <h2 className="insight-card__title">A reforzar</h2>
          <p className="insight-card__value">
            {evaluation.weakestRound.label}
          </p>
          <p className="insight-card__detail">
            {evaluation.weakestRound.score} pts
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
            {trendLabel}
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
                </div>
                <p>{turn.richFeedback.whyScore}</p>
                <p className="round-breakdown__quote">
                  Dijiste: &ldquo;{turn.utterance}&rdquo;
                </p>
                {turn.richFeedback.analytics ? (
                  <AnalyticsChips analytics={turn.richFeedback.analytics} />
                ) : null}
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
          {historyActionLabel}
        </Button>
      </div>
    </section>
  );
}
