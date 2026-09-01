"use client";

import type { EndSessionResponse, TurnSummary } from "@/lib/api/client";
import { computeLocalTrend } from "@/lib/history/local";

interface EvaluationScreenProps {
  result: EndSessionResponse;
  turns: TurnSummary[];
  clientName: string;
  scenarioSlug: string;
  totalRounds: number;
  onRepeat: () => void;
  onOtherClient: () => void;
}

export function EvaluationScreen({
  result,
  turns,
  clientName,
  scenarioSlug,
  totalRounds,
  onRepeat,
  onOtherClient,
}: EvaluationScreenProps) {
  const { evaluation } = result;
  const localTrend = computeLocalTrend(scenarioSlug);
  const trend =
    evaluation.trend && evaluation.trend.attempts > 1
      ? evaluation.trend
      : localTrend && localTrend.attempts > 1
        ? localTrend
        : null;

  return (
    <section className="screen active" aria-label="Evaluación de la llamada">
      <h2>Evaluación de la llamada</h2>

      <div className={`eval ${result.won ? "good" : "bad"}`}>
        <h3>{result.won ? "¡Ganaste!" : "No cerraste el objetivo"}</h3>
        <p className="verdict">{evaluation.verdict}</p>
        <p>
          Promedio: {result.totalScore}/100 · Turnos: {result.turnsCompleted}/
          {totalRounds}
        </p>
      </div>

      <div className="eval-summary-grid">
        <div className="summary-card good">
          <strong>Mejor ronda</strong>
          <p>
            {evaluation.strongestRound.label} — {evaluation.strongestRound.score}
            /100
          </p>
        </div>
        <div className="summary-card bad">
          <strong>Ronda a reforzar</strong>
          <p>
            {evaluation.weakestRound.label} — {evaluation.weakestRound.score}
            /100
          </p>
        </div>
      </div>

      <div className="drill-card">
        <strong>Próximo drill</strong>
        <p>{evaluation.nextDrill}</p>
      </div>

      {trend && (
        <div className="trend-card">
          <strong>Tendencia ({trend.attempts} intentos)</strong>
          <p>
            Promedio histórico: {trend.averageScore.toFixed(0)}/100
            {trend.improving ? " · Mejorando 📈" : " · Estable"}
          </p>
        </div>
      )}

      <h3 className="detail-heading">Detalle por ronda</h3>
      {turns.length === 0 ? (
        <p className="subtitle">No completaste ningún turno.</p>
      ) : (
        turns.map((turn) => (
          <div key={turn.roundKey} className="history-item rich">
            <strong>
              {turn.roundLabel} ({turn.roundScore} pts)
            </strong>
            <p className="feedback-why">{turn.richFeedback.whyScore}</p>
            <p className="exact-phrase">
              Dijiste: &ldquo;{turn.utterance}&rdquo;
            </p>
            <p className="exact-phrase expected">
              Línea más fuerte: <em>{turn.richFeedback.strongerLine}</em>
            </p>
            {turn.richFeedback.missedCriteria.length > 0 && (
              <p className="missed-criteria">
                Faltó: {turn.richFeedback.missedCriteria.join(", ")}
              </p>
            )}
          </div>
        ))
      )}

      <div className="controls">
        <button type="button" className="primary" onClick={onRepeat}>
          Repetir con {clientName}
        </button>
        <button type="button" onClick={onOtherClient}>
          Otro escenario
        </button>
      </div>
    </section>
  );
}
