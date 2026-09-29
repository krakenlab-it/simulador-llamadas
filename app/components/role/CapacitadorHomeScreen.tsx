"use client";

import { Card } from "@/app/components/ui/Card";

/**
 * Capacitador landing — informational only. Workflow controls live in shell tabs.
 */
export function CapacitadorHomeScreen() {
  return (
    <div className="role-home role-home--info">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Capacitador · back office</p>
        <h1 className="page-hero__title">Diseña, asigna y mide la práctica</h1>
        <p className="page-hero__subtitle">
          Jaime es un simulador de llamadas de venta para centros de contacto: tus agentes
          practican contra un comprador que responde en vivo, con coaching aparte y métricas
          claras para el equipo de capacitación.
        </p>
      </header>

      <div className="role-home__info-grid">
        <Card className="role-home__info-card">
          <h2 className="config-panel__title">Qué hace el simulador</h2>
          <p>
            Armas escenarios con perfil de comprador, objeciones y criterio de éxito. El agente
            habla por micrófono (o texto en pruebas internas) y vive una llamada de varias fases —
            apertura, objeción, cierre con día y hora — como en producción, sin riesgo para el
            cliente real.
          </p>
          <p>
            Tú pruebas primero la experiencia, publicas el caso en la biblioteca cuando esté listo
            y asignas cupo de simulaciones. Las calificaciones y el historial te dicen quién
            cumple métricas y dónde reforzar.
          </p>
        </Card>

        <Card className="role-home__info-card">
          <h2 className="config-panel__title">Para quién es</h2>
          <ul className="role-home__info-list">
            <li>
              <strong>Capacitadores y líderes de contact center</strong> que necesitan escalar la
              práctica sin depender solo de shadowing en llamadas reales.
            </li>
            <li>
              <strong>Equipos comerciales B2B</strong> con guiones exigentes, objeciones de
              tiempo y cierres con compromiso concreto.
            </li>
            <li>
              <strong>Agentes en formación</strong> que practican con escenarios asignados y
              feedback inmediato después de cada simulación.
            </li>
          </ul>
        </Card>

        <Card className="role-home__info-card">
          <h2 className="config-panel__title">Dónde trabajar en la app</h2>
          <p className="config-panel__hint role-home__info-lead">
            Esta pantalla es solo orientación. El trabajo operativo está en las pestañas del menú:
          </p>
          <dl className="role-home__info-dl">
            <div>
              <dt>Escenarios</dt>
              <dd>
                Crear y probar casos, publicar en la biblioteca y validar voz y dificultad antes
                de asignar.
              </dd>
            </div>
            <div>
              <dt>IA</dt>
              <dd>
                Describir el comprador en conversación; la IA propone el borrador para guardar y
                practicar.
              </dd>
            </div>
            <div>
              <dt>Agentes</dt>
              <dd>
                Perfil del agente (CV opcional), escenarios de la biblioteca y cupo de
                simulaciones requeridas.
              </dd>
            </div>
            <div>
              <dt>Calificaciones</dt>
              <dd>
                Scorecards, cumplimiento de métricas e historial por persona y por escenario.
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
