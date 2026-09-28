"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import {
  activeProject,
  createProject,
  readTrainingOffice,
  setActiveProject,
  writeTrainingOffice,
  type TrainingOfficeState,
} from "@/lib/frontend/training-office";

interface CapacitadorHomeScreenProps {
  onOpenScenarios: () => void;
  onOpenIa: () => void;
  onOpenAgents: () => void;
  onOpenGrades: () => void;
  onCreateScenario: () => void;
}

export function CapacitadorHomeScreen({
  onOpenScenarios,
  onOpenIa,
  onOpenAgents,
  onOpenGrades,
  onCreateScenario,
}: CapacitadorHomeScreenProps) {
  const [office, setOffice] = useState<TrainingOfficeState>(() =>
    typeof window !== "undefined" ? readTrainingOffice() : readTrainingOffice(),
  );
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    setOffice(readTrainingOffice());
  }, []);

  const project = activeProject(office, "capacitador");

  const persist = (next: TrainingOfficeState) => {
    setOffice(next);
    writeTrainingOffice(next);
  };

  return (
    <div className="role-home">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Capacitador · back office</p>
        <h1 className="page-hero__title">Diseña, asigna y mide la práctica</h1>
        <p className="page-hero__subtitle">
          Escoge el proyecto, arma de 1 a 10 escenarios, prueba la llamada y revisa cómo cumplen
          métricas tus agentes.
        </p>
      </header>

      <Card className="role-home__project">
        <h2 className="config-panel__title">Proyecto activo</h2>
        <label className="config-panel__label" htmlFor="cap-project-select">
          Simulación de este proyecto
        </label>
        <select
          id="cap-project-select"
          className="config-panel__select"
          value={project.id}
          onChange={(event) =>
            persist(setActiveProject(office, "capacitador", event.target.value))
          }
        >
          {office.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="role-home__inline-form">
          <input
            type="text"
            className="config-panel__input"
            placeholder="Nombre del nuevo proyecto"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            aria-label="Nombre del nuevo proyecto"
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (!newProjectName.trim()) return;
              persist(createProject(office, newProjectName));
              setNewProjectName("");
            }}
          >
            Crear proyecto
          </Button>
        </div>
      </Card>

      <ol className="role-home__steps" aria-label="Flujo del capacitador">
        <li>
          <Card>
            <h3>1. Escenarios</h3>
            <p>Perfil del comprador, briefing de fases y cómo se gana.</p>
            <div className="role-home__actions">
              <Button onClick={onCreateScenario}>Crear escenario</Button>
              <Button variant="secondary" onClick={onOpenScenarios}>
                Probar llamada
              </Button>
            </div>
          </Card>
        </li>
        <li>
          <Card>
            <h3>2. IA conversacional</h3>
            <p>
              Explica en voz o chat qué quieres medir; la IA rellena perfil, briefing y éxito.
            </p>
            <Button variant="secondary" onClick={onOpenIa}>Abrir IA</Button>
          </Card>
        </li>
        <li>
          <Card>
            <h3>3. Agentes y cupo</h3>
            <p>Asigna escenarios y cuántas simulaciones debe completar cada persona.</p>
            <Button variant="secondary" onClick={onOpenAgents}>Asignar agentes</Button>
          </Card>
        </li>
        <li>
          <Card>
            <h3>4. Calificaciones e insights</h3>
            <p>Revisa scorecards, cumplimiento de métricas y dónde debe mejorar cada agente.</p>
            <Button variant="secondary" onClick={onOpenGrades}>Ver calificaciones</Button>
          </Card>
        </li>
      </ol>
    </div>
  );
}
