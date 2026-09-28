"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import {
  activeProject,
  assignmentForAgent,
  countCompletedSimulations,
  readTrainingOffice,
  setActiveProject,
  writeTrainingOffice,
  type TrainingOfficeState,
} from "@/lib/frontend/training-office";

interface AgenteHomeScreenProps {
  agentEmail: string | null;
  agentDisplayName: string;
  onOpenPractice: () => void;
  onOpenResults: () => void;
}

export function AgenteHomeScreen({
  agentEmail,
  agentDisplayName,
  onOpenPractice,
  onOpenResults,
}: AgenteHomeScreenProps) {
  const [office, setOffice] = useState<TrainingOfficeState>(() => readTrainingOffice());

  useEffect(() => {
    setOffice(readTrainingOffice());
  }, []);

  const project = activeProject(office, "agente");
  const assignment = useMemo(
    () => assignmentForAgent(office, project.id, agentEmail),
    [office, project.id, agentEmail],
  );

  const completed = assignment
    ? countCompletedSimulations(assignment.scenarioSlugs)
    : 0;
  const required = assignment?.requiredSimulations ?? 0;
  const progressPct =
    required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;

  return (
    <div className="role-home">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Agente · práctica</p>
        <h1 className="page-hero__title">Hola, {agentDisplayName}</h1>
        <p className="page-hero__subtitle">
          Trabaja en el proyecto que te asignó el capacitador. Las simulaciones son solo por voz —
          como una llamada real.
        </p>
      </header>

      <Card className="role-home__project">
        <h2 className="config-panel__title">Tu proyecto</h2>
        <label className="config-panel__label" htmlFor="agent-project-select">
          Proyecto precargado
        </label>
        <select
          id="agent-project-select"
          className="config-panel__select"
          value={project.id}
          onChange={(event) => {
            const next = setActiveProject(office, "agente", event.target.value);
            setOffice(next);
            writeTrainingOffice(next);
          }}
        >
          {office.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      <Card className="role-home__progress">
        <h2 className="config-panel__title">Simulaciones asignadas</h2>
        {!assignment ? (
          <p className="config-panel__hint">
            Aún no hay asignación para <strong>{agentEmail ?? "tu cuenta"}</strong> en este
            proyecto. Pide al capacitador que te agregue en <em>Agentes</em>.
          </p>
        ) : (
          <>
            <p>
              Debes completar <strong>{required}</strong> simulaciones en{" "}
              <strong>{assignment.scenarioSlugs.length}</strong> escenario(s) asignado(s).
            </p>
            <div
              className="role-home__progress-bar"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso de simulaciones"
            >
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <p className="config-panel__hint">
              Completadas en este navegador: {completed} / {required}
            </p>
            {!assignment.showGradesToAgent ? (
              <p className="config-panel__hint config-panel__hint--warn">
                El capacitador ocultó las calificaciones numéricas; verás solo si cumpliste el cupo.
              </p>
            ) : null}
          </>
        )}
        <div className="role-home__actions">
          <Button onClick={onOpenPractice}>Ir a practicar</Button>
          <Button variant="secondary" onClick={onOpenResults}>
            Mis resultados
          </Button>
        </div>
      </Card>
    </div>
  );
}
