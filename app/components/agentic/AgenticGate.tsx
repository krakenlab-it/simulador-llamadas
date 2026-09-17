"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import {
  AGENTIC_DEMO_PASSWORD,
  setAgenticUnlocked,
  verifyAgenticPassword,
} from "@/lib/agentic/settings";

interface AgenticGateProps {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export function AgenticGate({ open, onClose, onUnlocked }: AgenticGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (verifyAgenticPassword(password)) {
      setAgenticUnlocked();
      setError(null);
      setPassword("");
      onUnlocked();
      return;
    }
    setError("Clave incorrecta. Intenta de nuevo.");
  };

  return (
    <div className="agentic-overlay" role="presentation">
      <div
        className="agentic-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agentic-gate-title"
      >
        <h2 id="agentic-gate-title" className="agentic-gate__title">
          Acceso restringido
        </h2>
        <p className="config-panel__hint">
          Ingresa la clave temporal para configurar la capa agentica.
        </p>
        <form className="agentic-gate__form" onSubmit={handleSubmit}>
          <label className="config-panel__label" htmlFor="agentic-password">
            Clave
          </label>
          <input
            id="agentic-password"
            className="config-panel__input"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder={`Demo: ${AGENTIC_DEMO_PASSWORD}`}
          />
          {error ? (
            <p className="agentic-gate__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="agentic-gate__actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Desbloquear
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
