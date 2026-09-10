import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { SelectWithOther } from "@/app/components/ui/SelectWithOther";
import {
  DIFFICULTY_LABEL_OPTIONS,
  OTHER_OPTION_VALUE,
  TEMPERAMENT_OPTIONS,
} from "@/lib/scenarios/select-options";

vi.mock("@/lib/api/client", () => ({
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

function fieldRoot(label: string): HTMLElement {
  const control = screen.getByLabelText(label, { selector: "select" });
  const root = control.closest(".select-with-other");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Missing select-with-other root for ${label}`);
  }
  return root;
}

describe("ScenarioBuilderScreen Otro fields", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a typeable field when Temperamento is Otro beside Dificultad", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Completar datos para una simulación ejemplo" }),
    );

    await user.selectOptions(screen.getByLabelText("Temperamento"), "Otro");

    const temperamentRoot = fieldRoot("Temperamento");
    const otherInput = within(temperamentRoot).getByTestId("select-with-other-input");
    expect(otherInput).toBeVisible();
    expect(within(temperamentRoot).getByText("Puedes tipar tu opción personalizada.")).toBeInTheDocument();
    await user.click(otherInput);
    await user.paste("Directo y escéptico");
    expect(otherInput).toHaveValue("Directo y escéptico");
  });

  it("shows a typeable field when Dificultad uses the Otro sentinel", () => {
    function Harness() {
      return (
        <SelectWithOther
          label="Dificultad (etiqueta)"
          value={OTHER_OPTION_VALUE}
          options={DIFFICULTY_LABEL_OPTIONS}
          onChange={vi.fn()}
        />
      );
    }

    render(<Harness />);

    const root = fieldRoot("Dificultad (etiqueta)");
    expect(within(root).getByTestId("select-with-other-input")).toBeVisible();
    expect(within(root).getByLabelText("Escribe tu valor")).toHaveValue("");
  });

  it("shows a typeable field when Temperamento uses the Otro sentinel", () => {
    render(
      <SelectWithOther
        label="Temperamento"
        value={OTHER_OPTION_VALUE}
        options={TEMPERAMENT_OPTIONS}
        onChange={vi.fn()}
      />,
    );

    const root = fieldRoot("Temperamento");
    const otherInput = within(root).getByTestId("select-with-other-input");
    expect(otherInput).toBeVisible();
    expect(otherInput).toHaveAttribute("placeholder");
    expect(within(root).getByText("Puedes tipar tu opción personalizada.")).toBeInTheDocument();
  });
});
