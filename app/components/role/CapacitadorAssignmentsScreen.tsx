"use client";

import { useEffect, useId, useState } from "react";
import { listScenarios } from "@/lib/api/client";
import {
  isScenarioActiveForPractice,
  type ScenarioRecord,
} from "@/lib/scenarios/types";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Spinner } from "@/app/components/ui/Spinner";
import {
  activeProject,
  readTrainingOffice,
  upsertAssignment,
  writeTrainingOffice,
  type TrainingOfficeState,
} from "@/lib/frontend/training-office";

interface CapacitadorAssignmentsScreenProps {
  children?: React.ReactNode;
}

export function CapacitadorAssignmentsScreen({
  children,
}: CapacitadorAssignmentsScreenProps) {
  const formId = useId();
  const [office, setOffice] = useState<TrainingOfficeState>(() => readTrainingOffice());
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentEmail, setAgentEmail] = useState("agente@demo.local");
  const [agentName, setAgentName] = useState("Agente demo");
  const [required, setRequired] = useState(5);
  const [showGrades, setShowGrades] = useState(true);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  const project = activeProject(office, "capacitador");

  useEffect(() => {
    setLoading(true);
    void listScenarios()
      .then((rows) => {
        setScenarios(rows.filter(isScenarioActiveForPractice));
        const presets = rows
          .filter((s) => s.isPreset && isScenarioActiveForPractice(s))
          .map((s) => s.slug);
        setSelectedSlugs(presets.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = (next: TrainingOfficeState) => {
    setOffice(next);
    writeTrainingOffice(next);
  };

  const saveAssignment = () => {
    const next = upsertAssignment(office, {
      projectId: project.id,
      agentEmail: agentEmail.trim(),
      agentDisplayName: agentName.trim() || agentEmail.trim(),
      scenarioSlugs: selectedSlugs,
      requiredSimulations: Math.max(1, Math.min(10, required)),
      showGradesToAgent: showGrades,
    });
    persist(next);
  };

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const existing = office.assignments.filter((a) => a.projectId === project.id);

  return (
    <div className="role-assignments">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Capacitador · Agentes</p>
        <h1 className="page-hero__title">Asigna escenarios y cupo</h1>
        <p className="page-hero__subtitle">
          Define qué casos practica cada agente y cuántas simulaciones debe completar. Persistencia
          local de demo — sustituir por back office en producción.
        </p>
      </header>

      <Card className="role-assignments__form">
        <h2 className="config-panel__title">Nueva o actualizar asignación</h2>
        <div className="role-assignments__grid">
          <label className="config-panel__label" htmlFor={`${formId}-email`}>
            Correo del agente
          </label>
          <input
            id={`${formId}-email`}
            className="config-panel__input"
            value={agentEmail}
            onChange={(e) => setAgentEmail(e.target.value)}
          />
          <label className="config-panel__label" htmlFor={`${formId}-name`}>
            Nombre visible
          </label>
          <input
            id={`${formId}-name`}
            className="config-panel__input"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
          <label className="config-panel__label" htmlFor={`${formId}-quota`}>
            Simulaciones requeridas (1–10)
          </label>
          <input
            id={`${formId}-quota`}
            type="number"
            min={1}
            max={10}
            className="config-panel__input"
            value={required}
            onChange={(e) => setRequired(Number(e.target.value))}
          />
        </div>

        <label className="config-panel__label">Escenarios incluidos</label>
        {loading ? (
          <Spinner label="Cargando escenarios…" />
        ) : (
          <ul className="role-assignments__checks">
            {scenarios.map((s) => (
              <li key={s.slug}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedSlugs.includes(s.slug)}
                    onChange={() => toggleSlug(s.slug)}
                  />
                  {s.clientName}
                  {s.isPreset ? " (clínica)" : " (propio)"}
                </label>
              </li>
            ))}
          </ul>
        )}

        <label className="role-assignments__toggle">
          <input
            type="checkbox"
            checked={showGrades}
            onChange={(e) => setShowGrades(e.target.checked)}
          />
          El agente puede ver calificaciones y métricas
        </label>

        <Button onClick={saveAssignment}>Guardar asignación</Button>
      </Card>

      {existing.length > 0 ? (
        <Card>
          <h2 className="config-panel__title">Asignaciones en {project.name}</h2>
          <ul className="role-assignments__list">
            {existing.map((a) => (
              <li key={a.id}>
                <strong>{a.agentDisplayName}</strong> ({a.agentEmail}) — {a.scenarioSlugs.length}{" "}
                escenarios · cupo {a.requiredSimulations}
                {a.showGradesToAgent ? "" : " · notas ocultas al agente"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {children}
    </div>
  );
}
