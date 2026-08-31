"use client";

import type { EndSessionResponse, TurnSummary } from "@/lib/api/client";

interface EvaluationScreenProps {
  result: EndSessionResponse;
  turns: TurnSummary[];
  clientName: string;
  onRepeat: () => void;
  onOtherClient: () => void;
}

export function EvaluationScreen({
  result,
  turns,
  clientName,
  onRepeat,
  onOtherClient,
}: EvaluationScreenProps) {
  return (
    <section className="screen active" aria-label="Evaluación de la llamada">
      <h2>Evaluación de la llamada</h2>

      <div className={`eval ${result.won ? "good" : "bad"}`}>
        <h3>
          {result.won
            ? "¡Ganaste la cita!"
            : "No cerraste con día y hora"}
        </h3>
        <p>
          Promedio: {result.totalScore}/100 · Turnos completados:{" "}
          {result.turnsCompleted}/5
        </p>
        <p>
          {result.won
            ? "Lograste una reunión con fecha y hora concretas."
            : "En el cierre debes proponer un día y una hora específicos."}
        </p>
      </div>

      <h3 className="detail-heading">Detalle por ronda</h3>
      {turns.length === 0 ? (
        <p className="subtitle">No completaste ningún turno.</p>
      ) : (
        turns.map((turn) => (
          <div key={turn.roundType} className="history-item">
            <strong>{turn.roundType}</strong> ({turn.roundScore} pts) —{" "}
            {turn.expectedPhrase}
            <p className="exact-phrase">
              Dijiste: &ldquo;{turn.utterance}&rdquo;
            </p>
            <p className="exact-phrase expected">
              Debías decir algo como: <em>{turn.expectedPhrase}</em>
            </p>
          </div>
        ))
      )}

      <div className="controls">
        <button type="button" className="primary" onClick={onRepeat}>
          Repetir con {clientName}
        </button>
        <button type="button" onClick={onOtherClient}>
          Otro cliente
        </button>
      </div>
    </section>
  );
}
