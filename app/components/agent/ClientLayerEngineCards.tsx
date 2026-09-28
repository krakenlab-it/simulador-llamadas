"use client";

import { useId, useState, type FocusEvent } from "react";
import {
  CLIENT_LAYER_ENGINES,
  patchClientLayerEngineCopy,
  resolvedClientLayerEngineCopy,
  type ClientLayerEngineId,
  type ClientLayerSettings,
} from "@/lib/agent/client-layer";

interface ClientLayerEngineCardsProps {
  layer: ClientLayerSettings;
  onChange: (next: ClientLayerSettings) => void;
}

export function ClientLayerEngineCards({
  layer,
  onChange,
}: ClientLayerEngineCardsProps) {
  const hintId = useId();
  const [editingId, setEditingId] = useState<ClientLayerEngineId | null>(null);

  const startEdit = (id: ClientLayerEngineId) => {
    setEditingId(id);
  };

  const finishEdit = () => {
    setEditingId(null);
  };

  const handleCardBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    finishEdit();
  };

  return (
    <div
      className="client-engines"
      role="list"
      aria-labelledby={hintId}
      aria-label="Capas del cliente"
    >
      <p id={hintId} className="visually-hidden">
        Pulsa el título o el texto de cada tarjeta para editar las reglas del
        cliente en vivo. Los cambios se guardan en este navegador.
      </p>
      {CLIENT_LAYER_ENGINES.map((engine) => {
        const copy = resolvedClientLayerEngineCopy(layer, engine.id);
        const isEditing = editingId === engine.id;
        return (
          <article
            key={engine.id}
            className={`client-engines__card ${isEditing ? "client-engines__card--editing" : ""}`}
            role="listitem"
            onBlur={isEditing ? handleCardBlur : undefined}
          >
            {isEditing ? (
              <>
                <label className="client-engines__field">
                  <span className="client-engines__field-label">Título</span>
                  <input
                    className="client-engines__input"
                    value={copy.title}
                    autoFocus
                    onChange={(event) =>
                      onChange(
                        patchClientLayerEngineCopy(layer, engine.id, {
                          title: event.target.value,
                        }),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") finishEdit();
                    }}
                  />
                </label>
                <label className="client-engines__field">
                  <span className="client-engines__field-label">Regla</span>
                  <textarea
                    className="client-engines__textarea"
                    rows={3}
                    value={copy.body}
                    onChange={(event) =>
                      onChange(
                        patchClientLayerEngineCopy(layer, engine.id, {
                          body: event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </>
            ) : (
              <button
                type="button"
                className="client-engines__editable"
                onClick={() => startEdit(engine.id)}
              >
                <h3>{copy.title}</h3>
                <p>{copy.body}</p>
                <span className="client-engines__edit-hint">Clic para editar</span>
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
