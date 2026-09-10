import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { clearLocalCustomScenarios } from "@/lib/scenarios/local";
import { resetStubSessions } from "@/lib/api/stubs";

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("ScenarioBuilderScreen preview fallback", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetStubSessions();
    clearLocalCustomScenarios();
  });

  it("saves without the red error when POST /api/scenarios returns 500", async () => {
    mockFetchOnce(500, { error: "No se pudo crear el escenario." });
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={onSave} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.type(screen.getByPlaceholderText(/Laura Méndez/i), "Carlos Ruiz");
    await user.type(screen.getByPlaceholderText(/Gerente de sucursal/i), "Dueño");
    await user.type(
      screen.getByPlaceholderText(/Importadora del Norte/i),
      "Taller Norte",
    );
    await user.selectOptions(screen.getByLabelText("Tipo de empresa / industria"), "Otro");
    await user.type(
      screen.getByPlaceholderText(/Escribe tu valor/i),
      "taller de llantas",
    );
    await user.selectOptions(screen.getByLabelText("¿Qué se vende?"), "Otro");
    await user.type(
      screen.getByPlaceholderText(/membresía premium/i),
      "llantas premium",
    );
    await user.type(
      screen.getByPlaceholderText(/Qué le duele hoy/i),
      "rotación lenta",
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const win = screen.getByPlaceholderText(/Cita con día y hora/i);
    await user.clear(win);
    await user.type(win, "Visita al taller el martes a las 10");

    await user.click(screen.getByRole("button", { name: "Guardar escenario" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          usedLocalFallback: true,
          scenario: expect.objectContaining({
            clientName: "Carlos Ruiz",
            isPreset: false,
          }),
        }),
      );
    });

    expect(
      screen.queryByText("No se pudo crear el escenario."),
    ).not.toBeInTheDocument();
  });
});
