"use client";

import { useEffect, useState } from "react";
import { loadLocalHistory } from "@/lib/history/local";
import { formatHistoryEntries } from "@/lib/frontend/format-history";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Spinner } from "@/app/components/ui/Spinner";

interface HistoryViewProps {
  refreshKey?: number;
  onStartTraining?: () => void;
}

export function HistoryView({
  refreshKey = 0,
  onStartTraining,
}: HistoryViewProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReturnType<typeof formatHistoryEntries>>([]);

  useEffect(() => {
    setLoading(true);
    const entries = loadLocalHistory();
    setRows(formatHistoryEntries(entries));
    setLoading(false);
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="history-view history-view--loading">
        <Spinner label="Cargando historial…" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="history-view">
        <header className="page-hero page-hero--compact">
          <h1 className="page-hero__title">Historial</h1>
          <p className="page-hero__subtitle">
            Tus llamadas de práctica aparecerán aquí después de colgar y recibir
            tu evaluación.
          </p>
        </header>
        <EmptyState
          title="Sin llamadas todavía"
          description="Completa tu primera simulación para ver puntuación, resultado y tendencia por escenario."
          actionLabel="Ir a entrenar"
          onAction={onStartTraining}
        />
      </div>
    );
  }

  return (
    <div className="history-view">
      <header className="page-hero page-hero--compact">
        <h1 className="page-hero__title">Historial</h1>
        <p className="page-hero__subtitle">
          {rows.length} {rows.length === 1 ? "llamada registrada" : "llamadas registradas"} en este dispositivo
        </p>
      </header>

      <ul className="history-list" aria-label="Llamadas anteriores">
        {rows.map((row) => (
          <li key={row.id} className="history-list__item">
            <div className="history-list__main">
              <span className="history-list__client">{row.clientName}</span>
              <span className="history-list__when">{row.when}</span>
            </div>
            <div className="history-list__meta">
              <span>{row.difficultyLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{row.modeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{row.scoreLabel}</span>
            </div>
            <span
              className={`history-list__outcome history-list__outcome--${row.outcomeTone}`}
            >
              {row.outcomeLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
