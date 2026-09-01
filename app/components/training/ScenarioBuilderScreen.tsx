"use client";

import { useState } from "react";
import { createScenario } from "@/lib/api/client";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import { Button } from "@/app/components/ui/Button";

export interface ScenarioBuilderResult {
  scenario: ScenarioRecord;
}

interface ScenarioBuilderScreenProps {
  onSave: (result: ScenarioBuilderResult) => void;
  onCancel: () => void;
}

const DEFAULT_OBJECTIONS = ["", ""];

export function ScenarioBuilderScreen({ onSave, onCancel }: ScenarioBuilderScreenProps) {
  const [industry, setIndustry] = useState("");
  const [productSold, setProductSold] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientTitle, setClientTitle] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [temperament, setTemperament] = useState("Escéptico, poco tiempo");
  const [difficultyLabel, setDifficultyLabel] = useState("Media");
  const [clientProblem, setClientProblem] = useState("");
  const [objections, setObjections] = useState(DEFAULT_OBJECTIONS);
  const [winCriteria, setWinCriteria] = useState(
    "Reunión o siguiente paso con día y hora concretos",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    industry.trim() &&
    productSold.trim() &&
    clientName.trim() &&
    clientTitle.trim() &&
    companyContext.trim() &&
    clientProblem.trim() &&
    winCriteria.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const scenario = await createScenario({
        industry: industry.trim(),
        productSold: productSold.trim(),
        clientName: clientName.trim(),
        clientTitle: clientTitle.trim(),
        companyContext: companyContext.trim(),
        temperament: temperament.trim(),
        difficultyLabel: difficultyLabel.trim(),
        clientProblem: clientProblem.trim(),
        objections: objections.map((o) => o.trim()).filter(Boolean),
        winCriteria: winCriteria.trim(),
      });
      onSave({ scenario });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="builder-screen" aria-label="Crear escenario">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Escenario personalizado</p>
        <h1 className="page-hero__title">Diseña tu caso de venta</h1>
        <p className="page-hero__subtitle">
          Define industria, cliente y criterio de éxito. El motor de cinco rondas
          se adapta a tu contexto.
        </p>
      </header>

      <div className="builder-form">
        <fieldset className="builder-form__group">
          <legend>Detalles del negocio</legend>
          <div className="builder-form__grid">
            <label className="field">
              <span className="field__label">Industria / negocio</span>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Ej. sucursal bancaria, taller de llantas"
              />
            </label>
            <label className="field">
              <span className="field__label">¿Qué se vende?</span>
              <input
                value={productSold}
                onChange={(e) => setProductSold(e.target.value)}
                placeholder="Ej. membresía premium, póliza de auto"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="builder-form__group">
          <legend>Persona del cliente</legend>
          <div className="builder-form__grid">
            <label className="field">
              <span className="field__label">Nombre</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Laura Méndez"
              />
            </label>
            <label className="field">
              <span className="field__label">Rol</span>
              <input
                value={clientTitle}
                onChange={(e) => setClientTitle(e.target.value)}
                placeholder="Ej. Gerente de sucursal"
              />
            </label>
            <label className="field field--full">
              <span className="field__label">Empresa / contexto</span>
              <input
                value={companyContext}
                onChange={(e) => setCompanyContext(e.target.value)}
                placeholder="Ej. Cadena nacional de gimnasios"
              />
            </label>
            <label className="field">
              <span className="field__label">Temperamento</span>
              <input
                value={temperament}
                onChange={(e) => setTemperament(e.target.value)}
                placeholder="Ej. Escéptico, directo"
              />
            </label>
            <label className="field">
              <span className="field__label">Dificultad (etiqueta)</span>
              <input
                value={difficultyLabel}
                onChange={(e) => setDifficultyLabel(e.target.value)}
                placeholder="Media"
              />
            </label>
            <label className="field field--full">
              <span className="field__label">Problema real del cliente</span>
              <textarea
                value={clientProblem}
                onChange={(e) => setClientProblem(e.target.value)}
                placeholder="¿Qué le duele hoy?"
                rows={2}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="builder-form__group">
          <legend>Objeciones y cierre</legend>
          <div className="builder-form__grid">
            {objections.map((obj, i) => (
              <label key={`obj-${i}`} className="field field--full">
                <span className="field__label">Objeción esperada {i + 1}</span>
                <input
                  value={obj}
                  onChange={(e) => {
                    const next = [...objections];
                    next[i] = e.target.value;
                    setObjections(next);
                  }}
                  placeholder="Ej. Ya tenemos proveedor"
                />
              </label>
            ))}
            <label className="field field--full">
              <span className="field__label">¿Qué cuenta como ganar?</span>
              <input
                value={winCriteria}
                onChange={(e) => setWinCriteria(e.target.value)}
                placeholder="Ej. Cita con día y hora para demo"
              />
            </label>
          </div>
        </fieldset>

        <p className="builder-form__note">
          Mismo flujo de cinco rondas: Apertura → Objeción → Claridad → Correo →
          Cierre.
        </p>

        {error ? <p className="builder-form__error" role="alert">{error}</p> : null}

        <div className="builder-form__actions">
          <Button
            variant="primary"
            disabled={!canSave}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Guardar escenario
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Volver
          </Button>
        </div>
      </div>
    </section>
  );
}
