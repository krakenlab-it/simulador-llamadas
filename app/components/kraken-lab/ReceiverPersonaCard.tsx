"use client";

import type { ReceiverPersona } from "@/lib/kraken-lab/types";
import { Card } from "@/app/components/ui/Card";

interface ReceiverPersonaCardProps {
  persona: ReceiverPersona;
  selected?: boolean;
  onSelect?: () => void;
}

export function ReceiverPersonaCard({
  persona,
  selected = false,
  onSelect,
}: ReceiverPersonaCardProps) {
  return (
    <div className="scenario-card-wrap">
      <Card
        interactive={Boolean(onSelect)}
        selected={selected}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-pressed={onSelect ? selected : undefined}
        onClick={onSelect}
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect();
                }
              }
            : undefined
        }
      >
        <div className="scenario-card__head">
          <h3 className="scenario-card__name">{persona.name}</h3>
          <span className="chip chip--custom">{persona.difficultyLabel}</span>
        </div>
        <p className="scenario-card__role">
          {persona.role} · {persona.company}
        </p>
        <p className="scenario-card__hint">{persona.indicator}</p>
        {persona.painPoints.length > 0 ? (
          <ul className="scenario-card__pains">
            {persona.painPoints.slice(0, 3).map((pain) => (
              <li key={pain}>{pain}</li>
            ))}
          </ul>
        ) : null}
        <p className="scenario-card__hint">Temperamento: {persona.temperament}</p>
      </Card>
    </div>
  );
}
