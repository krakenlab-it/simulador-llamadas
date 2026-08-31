"use client";

import { useState } from "react";
import { createScenario } from "@/lib/api/client";
import type { ScenarioRecord } from "@/lib/scenarios/types";

export interface ScenarioBuilderResult {
  scenario: ScenarioRecord;
}

interface ScenarioBuilderScreenProps {
  traineeId: string | null;
  onSave: (result: ScenarioBuilderResult) => void;
  onCancel: () => void;
}

const DEFAULT_OBJECTIONS = ["", ""];

export function ScenarioBuilderScreen({
  traineeId,
  onSave,
  onCancel,
}: ScenarioBuilderScreenProps) {
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
        traineeId: traineeId ?? undefined,
      });
      onSave({ scenario });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen active" aria-label="Constructor de escenario">
      <h2>Crear escenario de entrenamiento</h2>
      <p className="subtitle">
        Define cualquier caso de venta — banco, llantas, gym, SaaS, seguros. La
        IA adaptará el cliente simulado y la evaluación.
      </p>

      <h3 className="section-label">Detalles del negocio</h3>
      <div className="builder-grid">
        <label>
          Industria / negocio
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Ej. sucursal bancaria, taller de llantas"
          />
        </label>
        <label>
          ¿Qué se vende?
          <input
            value={productSold}
            onChange={(e) => setProductSold(e.target.value)}
            placeholder="Ej. membresía premium, póliza de auto"
          />
        </label>
      </div>

      <h3 className="section-label">Persona del cliente</h3>
      <div className="builder-grid">
        <label>
          Nombre del cliente
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Ej. Laura Méndez"
          />
        </label>
        <label>
          Rol del cliente
          <input
            value={clientTitle}
            onChange={(e) => setClientTitle(e.target.value)}
            placeholder="Ej. Gerente de sucursal"
          />
        </label>
        <label className="full-width">
          Empresa / contexto
          <input
            value={companyContext}
            onChange={(e) => setCompanyContext(e.target.value)}
            placeholder="Ej. Cadena nacional de gimnasios"
          />
        </label>
        <label>
          Temperamento
          <input
            value={temperament}
            onChange={(e) => setTemperament(e.target.value)}
            placeholder="Ej. Escéptico, directo"
          />
        </label>
        <label>
          Dificultad (etiqueta)
          <input
            value={difficultyLabel}
            onChange={(e) => setDifficultyLabel(e.target.value)}
            placeholder="Media"
          />
        </label>
        <label className="full-width">
          Problema real del cliente
          <textarea
            value={clientProblem}
            onChange={(e) => setClientProblem(e.target.value)}
            placeholder="¿Qué le duele hoy? Ej. rotación de clientes en sucursal"
            rows={2}
          />
        </label>
      </div>

      <h3 className="section-label">Objeciones y cierre</h3>
      <div className="builder-grid">
        {objections.map((obj, i) => (
          <label key={`obj-${i}`} className="full-width">
            Objeción esperada {i + 1}
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
        <label className="full-width">
          ¿Qué cuenta como ganar?
          <input
            value={winCriteria}
            onChange={(e) => setWinCriteria(e.target.value)}
            placeholder="Ej. Cita con día y hora para demo"
          />
        </label>
      </div>

      <p className="note">
        Rondas por defecto: Apertura → Objeción → Claridad → Correo → Cierre (5
        turnos). Puedes personalizarlas después en una versión futura.
      </p>

      {error && <p className="note warn">{error}</p>}

      <div className="controls">
        <button type="button" className="primary" disabled={!canSave || saving} onClick={() => void handleSave()}>
          {saving ? "Guardando…" : "Guardar escenario"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
