"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Switch } from "@/app/components/ui/Switch";
import {
  TONE_BANK,
  type ToneId,
  isToneId,
} from "@/lib/agentic";
import {
  getAgenticTonePreview,
  isAgenticEnabledForSimulations,
  isAgenticUnlocked,
  setAgenticEnabledForSimulations,
  setAgenticTonePreview,
} from "@/lib/agentic/settings";
import { KRAKEN_SIMULACION_PRODUCT_NAME } from "@/lib/kraken-lab/constants";

interface AgenticPanelProps {
  onClose: () => void;
}

const ENGINES = [
  {
    title: "Grounding",
    body: "Recupera fragmentos del escenario y rechaza cifras o nombres inventados.",
  },
  {
    title: "Persona + tono",
    body: "Combina la persona del cliente con un perfil emocional (molesto, intriga, etc.).",
  },
  {
    title: "Diálogo",
    body: "Genera réplicas del cliente ancladas a la documentación subida y a los campos del escenario, con fallback determinista.",
  },
  {
    title: "Coach",
    body: "Notas separadas para el vendedor; nunca habla como el cliente.",
  },
];

export function AgenticPanel({ onClose }: AgenticPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [tonePreview, setTonePreview] = useState<ToneId | "">("");

  useEffect(() => {
    setEnabled(isAgenticEnabledForSimulations());
    const saved = getAgenticTonePreview();
    setTonePreview(saved ?? "");
  }, []);

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    setAgenticEnabledForSimulations(next);
  };

  const handleToneChange = (value: string) => {
    if (!value) {
      setTonePreview("");
      setAgenticTonePreview(null);
      return;
    }
    if (!isToneId(value)) return;
    setTonePreview(value);
    setAgenticTonePreview(value);
  };

  if (!isAgenticUnlocked()) {
    return null;
  }

  return (
    <div className="agentic-panel">
      <header className="agentic-panel__header">
        <div>
          <p className="page-hero__eyebrow">{KRAKEN_SIMULACION_PRODUCT_NAME} · avanzado</p>
          <h1 className="page-hero__title">Capa agentica</h1>
          <p className="page-hero__subtitle">
            Cuatro motores coordinados para {KRAKEN_SIMULACION_PRODUCT_NAME} y escenarios
            personalizados. Las réplicas se anclan a la documentación y a los campos del escenario.
            Los presets de Clínica no cambian.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Volver al hub
        </Button>
      </header>

      <section className="agentic-panel__engines" aria-label="Motores agenticos">
        {ENGINES.map((engine) => (
          <article key={engine.title} className="agentic-panel__engine card">
            <h2 className="agentic-panel__engine-title">{engine.title}</h2>
            <p className="config-panel__hint">{engine.body}</p>
          </article>
        ))}
      </section>

      <section className="agentic-panel__settings card">
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          label={`Usar capa agentica en ${KRAKEN_SIMULACION_PRODUCT_NAME} y escenarios personalizados`}
        />

        <div className="agentic-panel__tones">
          <label className="config-panel__label" htmlFor="agentic-tone-preview">
            Vista previa de tono (facilitadores)
          </label>
          <select
            id="agentic-tone-preview"
            className="config-panel__input"
            value={tonePreview}
            onChange={(event) => handleToneChange(event.target.value)}
          >
            <option value="">Automático por semilla</option>
            {TONE_BANK.map((tone) => (
              <option key={tone.id} value={tone.id}>
                {tone.label} · intensidad {tone.intensity}/3
              </option>
            ))}
          </select>
        </div>

        <ul className="agentic-panel__tone-list" aria-label="Banco de tonos">
          {TONE_BANK.map((tone) => (
            <li key={tone.id}>
              <strong>{tone.label}</strong> — {tone.promptHint}
            </li>
          ))}
        </ul>
        <p className="config-panel__hint">
          Las respuestas en vivo usan solo hechos del pack: documentación subida y campos del
          escenario (producto, problema, objeciones, rondas).
        </p>
      </section>
    </div>
  );
}
