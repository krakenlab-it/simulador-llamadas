"use client";

import { AnalyticsChips } from "@/app/components/call/AnalyticsChips";
import type { TurnFeedbackEntry } from "@/lib/call/turn-feedback";

interface TurnFeedbackRailProps {
  entries: TurnFeedbackEntry[];
  onToggle: (id: string) => void;
}

export function TurnFeedbackRail({ entries, onToggle }: TurnFeedbackRailProps) {
  if (entries.length === 0) return null;

  return (
    <section className="turn-feedback" aria-label="Coaching por turno">
      <ol className="turn-feedback__list" aria-label="Historial de coaching">
        {entries.map((entry) => {
          const expanded = !entry.collapsed;
          return (
            <li
              key={entry.id}
              className={`turn-feedback__item ${
                entry.collapsed ? "turn-feedback__item--collapsed" : ""
              }`}
            >
              <div className="turn-feedback__strip">
                <p className="turn-feedback__meta">
                  Turno {entry.turnIndex} · {entry.roundLabel}
                  {Number.isFinite(entry.score) ? ` · ${entry.score}` : ""}
                </p>
                <button
                  type="button"
                  className="turn-feedback__toggle"
                  aria-expanded={expanded}
                  onClick={() => onToggle(entry.id)}
                >
                  {expanded ? "Ocultar coaching" : "Mostrar coaching"}
                </button>
              </div>
              {expanded ? (
                <div className="turn-feedback__body" role="status">
                  <p className="coaching-card__why">{entry.whyScore}</p>
                  {entry.strongerLine ? (
                    <p className="coaching-card__line">{entry.strongerLine}</p>
                  ) : null}
                  {entry.analytics ? (
                    <AnalyticsChips analytics={entry.analytics} />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
