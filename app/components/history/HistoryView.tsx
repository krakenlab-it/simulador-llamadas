"use client";

import { useEffect, useState } from "react";
import { listHistory, type HistoryEntry } from "@/lib/api/client";
import { formatHistoryEntries } from "@/lib/frontend/format-history";
import { loadLocalHistory } from "@/lib/history/local";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Spinner } from "@/app/components/ui/Spinner";

interface HistoryViewProps {
  refreshKey?: number;
  traineeId?: string | null;
  traineeEmail?: string | null;
  onStartTraining?: () => void;
  onOpenCall?: (callAttemptId: string) => void;
}

function completedOnly(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter((entry) => entry.status === "completed");
}

export function HistoryView({
  refreshKey = 0,
  traineeId = null,
  traineeEmail = null,
  onStartTraining,
  onOpenCall,
}: HistoryViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReturnType<typeof formatHistoryEntries>>([]);

  const hasServerIdentity = Boolean(traineeId || traineeEmail);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!hasServerIdentity) {
        const local = loadLocalHistory();
        if (!cancelled) {
          setRows(formatHistoryEntries(local));
          setLoading(false);
        }
        return;
      }

      try {
        const history = await listHistory({
          traineeId,
          email: traineeEmail,
        });
        if (!cancelled) {
          setRows(formatHistoryEntries(completedOnly(history)));
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("No se pudo cargar tu historial. Intenta de nuevo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, traineeId, traineeEmail, hasServerIdentity]);

  if (loading) {
    return (
      <div className="history-view history-view--loading">
        <Spinner label="Cargando historial…" />
      </div>
    );
  }

  return (
    <div className="history-view dashboard-home">
      <header className="page-hero page-hero--compact dashboard-home__hero">
        <div>
          <p className="page-hero__eyebrow">Inicio</p>
          <h1 className="page-hero__title">Tus prácticas</h1>
          <p className="page-hero__subtitle">
            {rows.length === 0
              ? "Cada llamada queda guardada con su scorecard y coaching. Empieza una práctica cuando quieras."
              : `${rows.length} ${rows.length === 1 ? "llamada guardada" : "llamadas guardadas"} · abre una para ver el scorecard`}
          </p>
        </div>
        {onStartTraining ? (
          <Button
            variant="primary"
            size="lg"
            className="dashboard-home__cta"
            onClick={onStartTraining}
          >
            Nueva práctica
          </Button>
        ) : null}
      </header>

      {error ? <p className="dashboard-home__error">{error}</p> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Sin llamadas todavía"
          description="Completa tu primera simulación para ver escenario, duración, puntuación y coaching al refrescar."
        />
      ) : (
        <ul className="history-list" aria-label="Llamadas anteriores">
          {rows.map((row) => (
            <li key={row.id}>
              {onOpenCall ? (
                <button
                  type="button"
                  className="history-list__item history-list__item--button"
                  onClick={() => onOpenCall(row.id)}
                >
                  <HistoryRowContent row={row} />
                </button>
              ) : (
                <div className="history-list__item">
                  <HistoryRowContent row={row} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRowContent({
  row,
}: {
  row: ReturnType<typeof formatHistoryEntries>[number];
}) {
  return (
    <>
      <div className="history-list__main">
        <span className="history-list__client">{row.clientName}</span>
        <span className="history-list__score">{row.scoreLabel}</span>
      </div>
      <div className="history-list__meta">
        <span>{row.when}</span>
        <span aria-hidden="true">·</span>
        <span>{row.durationLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{row.turnsLabel}</span>
      </div>
      <span
        className={`history-list__outcome history-list__outcome--${row.outcomeTone}`}
      >
        {row.outcomeLabel}
      </span>
    </>
  );
}
