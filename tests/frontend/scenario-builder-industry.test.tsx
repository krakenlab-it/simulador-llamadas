import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api/client", () => ({
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

describe("ScenarioBuilderScreen industry block", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the prominent industry select and refreshes Problema real del cliente", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    expect(screen.getByLabelText("Tipo de empresa / industria")).toBeInTheDocument();
    expect(screen.getByText("Nombre de la empresa / contexto")).toBeInTheDocument();
    expect(screen.queryByLabelText("Industria / negocio")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Tipo de empresa / industria"),
      "Gimnasios y wellness",
    );

    const problem = screen.getByLabelText("Problema real del cliente");
    expect(problem).toHaveValue(
      "Renovaciones y leads se enfrían por seguimiento manual entre recepción, ventas y entrenadores.",
    );
  });
});
