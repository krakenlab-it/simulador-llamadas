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
  const labelEl = screen.getByText(label, { selector: ".field__label" });
  const root = labelEl.closest(".select-with-other");
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

  it("shows a typeable textbox when Temperamento is Otro beside Dificultad", async () => {
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
    const otherInput = within(temperamentRoot).getByRole("textbox");
    expect(otherInput).toBeVisible();
    expect(within(temperamentRoot).getByText("Modo personalizado: escribe aquí.")).toBeInTheDocument();
    await user.click(otherInput);
    await user.paste("Directo y escéptico");
    expect(otherInput).toHaveValue("Directo y escéptico");
  });

  it("shows a typeable textbox when Dificultad uses the Otro sentinel", () => {
    render(
      <SelectWithOther
        label="Dificultad (etiqueta)"
        value={OTHER_OPTION_VALUE}
        options={DIFFICULTY_LABEL_OPTIONS}
        onChange={vi.fn()}
      />,
    );

    const root = fieldRoot("Dificultad (etiqueta)");
    expect(within(root).getByRole("textbox")).toBeVisible();
    expect(within(root).getByRole("textbox")).toHaveValue("");
  });

  it("shows a typeable textbox when Temperamento uses the Otro sentinel", () => {
    render(
      <SelectWithOther
        label="Temperamento"
        value={OTHER_OPTION_VALUE}
        options={TEMPERAMENT_OPTIONS}
        onChange={vi.fn()}
      />,
    );

    const root = fieldRoot("Temperamento");
    const otherInput = within(root).getByRole("textbox");
    expect(otherInput).toBeVisible();
    expect(otherInput).toHaveAttribute("placeholder");
    expect(within(root).getByText("Modo personalizado: escribe aquí.")).toBeInTheDocument();
  });

  it("replaces ¿Qué se vende? with a typeable textbox when Otro is selected", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioBuilderScreen onSave={vi.fn()} onCancel={vi.fn()} />
      </ToastProvider>,
    );

    await user.selectOptions(screen.getByLabelText("¿Qué se vende?"), "Otro");

    const root = fieldRoot("¿Qué se vende?");
    const textbox = within(root).getByRole("textbox");
    expect(textbox).toBeVisible();
    await user.click(textbox);
    await user.paste("Kraken Flow");
    expect(textbox).toHaveValue("Kraken Flow");
  });
});
