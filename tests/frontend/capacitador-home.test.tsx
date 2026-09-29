/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapacitadorHomeScreen } from "@/app/components/role/CapacitadorHomeScreen";

describe("CapacitadorHomeScreen", () => {
  it("is informational only — no project or workflow controls", () => {
    render(<CapacitadorHomeScreen />);

    expect(
      screen.getByRole("heading", { name: /Diseña, asigna y mide la práctica/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/simulador de llamadas de venta/i)).toBeInTheDocument();
    expect(screen.getByText(/Esta pantalla es solo orientación/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/Simulación de este proyecto/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nombre del nuevo proyecto/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear proyecto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear escenario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Probar llamada/i })).not.toBeInTheDocument();
  });
});
