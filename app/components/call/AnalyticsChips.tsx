"use client";

import type { CallAnalytics } from "@/lib/scoring/types";

interface AnalyticsChipsProps {
  analytics: CallAnalytics;
}

function formatQuestionTypes(analytics: CallAnalytics): string {
  const parts: string[] = [];
  if (analytics.questionTypes.open > 0) {
    parts.push(`${analytics.questionTypes.open} abierta${analytics.questionTypes.open > 1 ? "s" : ""}`);
  }
  if (analytics.questionTypes.clarifying > 0) {
    parts.push(`${analytics.questionTypes.clarifying} clarif.`);
  }
  if (analytics.questionTypes.closed > 0) {
    parts.push(`${analytics.questionTypes.closed} cerrada${analytics.questionTypes.closed > 1 ? "s" : ""}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "ninguna";
}

export function AnalyticsChips({ analytics }: AnalyticsChipsProps) {
  return (
    <div className="analytics-chips" aria-label="Señales de la llamada">
      <span className="analytics-chips__item">
        Habla tú: {analytics.talkPercent}%
      </span>
      <span className="analytics-chips__item">
        Monólogo máx: {analytics.longestMonologueSeconds}s
      </span>
      <span className="analytics-chips__item">
        Preguntas: {formatQuestionTypes(analytics)}
      </span>
      <span className="analytics-chips__item">
        Paciencia:{" "}
        {analytics.patienceAfterBuyerTurnSeconds !== null
          ? `${analytics.patienceAfterBuyerTurnSeconds}s`
          : "—"}
      </span>
      <span
        className={`analytics-chips__item ${analytics.hasNextStep ? "analytics-chips__item--yes" : ""}`}
      >
        Siguiente paso: {analytics.hasNextStep ? "Sí" : "No"}
      </span>
    </div>
  );
}
