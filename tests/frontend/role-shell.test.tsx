/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "@/app/components/shell/AppShell";
import { RolePickerScreen } from "@/app/components/role/RolePickerScreen";

afterEach(() => cleanup());

describe("role-based shell", () => {
  it("shows IA tab for capacitador, not Agente", () => {
    render(
      <AppShell
        productRole="capacitador"
        user={{
          id: "1",
          displayName: "Jaime",
          email: "jaime@equipo",
          initials: "JA",
        }}
        activeTab="home"
        onTabChange={vi.fn()}
      >
        <p>Contenido</p>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "IA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escenarios" })).toBeInTheDocument();
  });

  it("shows practicar flow for agente", () => {
    render(
      <AppShell
        productRole="agente"
        user={{
          id: "2",
          displayName: "Ana",
          email: "ana@equipo",
          initials: "AN",
        }}
        activeTab="train"
        onTabChange={vi.fn()}
      >
        <p>Práctica</p>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Practicar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "IA" })).not.toBeInTheDocument();
  });

  it("role picker explains IA vs human agente", () => {
    render(<RolePickerScreen onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Cómo entras hoy/i })).toBeInTheDocument();
    expect(screen.getByText(/no es un login de persona/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Entrar como Capacitador/i }),
    ).toBeInTheDocument();
  });
});
