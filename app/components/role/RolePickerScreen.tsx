"use client";

import type { ProductRole } from "@/lib/frontend/product-role";
import { productRoleLabel } from "@/lib/frontend/product-role";
import { Button } from "@/app/components/ui/Button";

interface RolePickerScreenProps {
  onSelect: (role: ProductRole) => void;
}

export function RolePickerScreen({ onSelect }: RolePickerScreenProps) {
  return (
    <div className="role-picker">
      <header className="role-picker__header">
        <p className="role-picker__eyebrow">Simulador de Llamadas</p>
        <h1 className="role-picker__title">¿Cómo entras hoy?</h1>
        <p className="role-picker__lead">
          Elige tu rol. El <strong>Capacitador</strong> diseña escenarios y mide al equipo. El{" "}
          <strong>Agente</strong> practica llamadas asignadas por voz. La superficie{" "}
          <strong>IA</strong> (solo capacitador) arma casos a partir de instrucciones — no es un
          login de persona.
        </p>
      </header>

      <div className="role-picker__cards">
        <article className="role-card">
          <h2>Capacitador</h2>
          <p>
            Proyectos, escenarios, asignación a agentes, pruebas de calidad, calificaciones y
            visión de mejora con IA.
          </p>
          <Button variant="primary" onClick={() => onSelect("capacitador")}>
            Entrar como {productRoleLabel("capacitador")}
          </Button>
        </article>

        <article className="role-card">
          <h2>Agente</h2>
          <p>
            Elige el proyecto del back office, completa las simulaciones asignadas solo por voz y
            revisa las notas que el capacitador autorice.
          </p>
          <Button variant="secondary" onClick={() => onSelect("agente")}>
            Entrar como {productRoleLabel("agente")}
          </Button>
        </article>
      </div>
    </div>
  );
}
