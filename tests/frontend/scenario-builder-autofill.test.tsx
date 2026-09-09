import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { ToastProvider } from "@/components/ui/Toast";

describe("ScenarioBuilderScreen autofill", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("fills the example draft and shows a success toast", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Completar datos para una simulación ejemplo" }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Valeria Soto")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Importadora del Norte/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Ejemplo cargado/i),
    ).toBeInTheDocument();
  });
});
