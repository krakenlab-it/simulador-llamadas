import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api/client", () => ({
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

describe("ScenarioBuilderScreen validation UX", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists pending Otro productSold and blocks Continuar on persona", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.selectOptions(screen.getByLabelText("¿Qué se vende?"), "Otro");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByText("Pendiente: Falta qué se vende (escribe tu valor en Otro)."),
    ).toBeInTheDocument();
    expect(screen.getByText("Cliente", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("Fases de la llamada")).not.toBeInTheDocument();
  });

  it("shows empty clientName in red and blocks Continuar", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.clear(screen.getByPlaceholderText(/Laura Méndez/i));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Pendiente: Falta nombre del cliente.")).toBeInTheDocument();
    expect(screen.queryByText("Fases de la llamada")).not.toBeInTheDocument();
  });

  it("shows pending list on save when winCriteria is empty", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Completar datos para una simulación ejemplo" }),
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const win = screen.getByPlaceholderText(/Cita con día y hora/i);
    await user.clear(win);
    await user.click(screen.getByRole("button", { name: "Guardar escenario" }));

    expect(screen.getByText("Pendiente: Falta criterio de éxito.")).toBeInTheDocument();
    expect(screen.getByText("Completa los campos pendientes antes de guardar.")).toBeInTheDocument();
  });
});
