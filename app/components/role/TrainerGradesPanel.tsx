"use client";

import { Card } from "@/app/components/ui/Card";

/** Placeholder for IA-generated improvement vision — wire to scoring analytics later. */
export function TrainerGradesPanel() {
  return (
    <Card className="trainer-insights">
      <h2 className="config-panel__title">Visión de mejora (IA)</h2>
      <p className="config-panel__hint">
        Aquí el capacitador verá en qué fases falla cada agente y qué drill recomendar. Hoy usa el
        scorecard de cada llamada en el historial; la síntesis multi-llamada llegará con el back
        office.
      </p>
      <ul className="trainer-insights__list">
        <li>Revisa el <em>próximo drill</em> en cada scorecard tras colgar.</li>
        <li>Compara al equipo en la sección Equipos debajo.</li>
        <li>Ajusta si el agente puede ver notas en Asignar agentes.</li>
      </ul>
    </Card>
  );
}
