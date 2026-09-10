import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectWithOther } from "@/app/components/ui/SelectWithOther";
import {
  OTHER_OPTION_VALUE,
  resolveSelectWithOtherValue,
} from "@/lib/scenarios/select-options";

const OPTIONS = ["Retail", "Banca y servicios financieros"] as const;

function SelectHarness({
  initialValue = "",
  onChangeSpy,
}: {
  initialValue?: string;
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <SelectWithOther
      label="Industria / negocio"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
    />
  );
}

function fieldRoot(label: string): HTMLElement {
  const labelEl = screen.getByText(label, { selector: ".field__label" });
  const root = labelEl.closest(".select-with-other");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Missing select-with-other root for ${label}`);
  }
  return root;
}

describe("SelectWithOther", () => {
  afterEach(() => {
    cleanup();
  });

  it("replaces the select with a typeable textbox when Otro is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectHarness onChangeSpy={onChange} />);

    await user.selectOptions(screen.getByLabelText("Industria / negocio"), "Otro");

    expect(onChange).toHaveBeenCalledWith(OTHER_OPTION_VALUE);
    expect(screen.queryByLabelText("Industria / negocio", { selector: "select" })).not.toBeInTheDocument();

    const root = fieldRoot("Industria / negocio");
    const otherInput = within(root).getByRole("textbox");
    expect(otherInput).toBeVisible();
    expect(otherInput).toHaveAttribute("placeholder", "Escribe tu valor…");
    expect(otherInput).toHaveFocus();
    expect(within(root).getByText("Modo personalizado: escribe aquí.")).toBeInTheDocument();
  });

  it("stores a typed custom value instead of the sentinel", async () => {
    const user = userEvent.setup();

    render(<SelectHarness initialValue={OTHER_OPTION_VALUE} />);

    const otherInput = screen.getByRole("textbox");
    await user.click(otherInput);
    await user.paste("Taller de llantas");

    expect(otherInput).toHaveValue("Taller de llantas");
  });

  it("restores the select when Elegir de la lista is clicked", async () => {
    const user = userEvent.setup();

    render(<SelectHarness initialValue={OTHER_OPTION_VALUE} />);

    await user.click(screen.getByRole("button", { name: "Elegir de la lista" }));

    expect(screen.getByLabelText("Industria / negocio")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reloads a saved custom value as a typeable textbox", () => {
    render(<SelectHarness initialValue="Distribuidora regional" />);

    expect(screen.queryByLabelText("Industria / negocio", { selector: "select" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Distribuidora regional");
  });

  it("never shows the sentinel inside the text input", () => {
    render(<SelectHarness initialValue={OTHER_OPTION_VALUE} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).not.toHaveValue(OTHER_OPTION_VALUE);
  });

  it("stores a listed option without showing the custom textbox", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <SelectWithOther
          label="Temperamento"
          value={value}
          options={["Escéptico, poco tiempo", "Gatekeeper estricto"]}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Temperamento"), "Gatekeeper estricto");

    expect(screen.getByLabelText("Temperamento")).toHaveValue("Gatekeeper estricto");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("resolveSelectWithOtherValue", () => {
  it("treats the sentinel as Otro mode with an empty custom value", () => {
    expect(resolveSelectWithOtherValue(OTHER_OPTION_VALUE, OPTIONS)).toEqual({
      selectValue: OTHER_OPTION_VALUE,
      customValue: "",
      showOtherInput: true,
    });
  });
});
