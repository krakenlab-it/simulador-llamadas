import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("SelectWithOther", () => {
  afterEach(() => {
    cleanup();
  });

  it("reveals and focuses a custom input when Otro is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectHarness onChangeSpy={onChange} />);

    await user.selectOptions(screen.getByLabelText("Industria / negocio"), "Otro");

    expect(onChange).toHaveBeenCalledWith(OTHER_OPTION_VALUE);
    const otherInput = screen.getByLabelText("Escribe tu valor");
    expect(otherInput).toBeInTheDocument();
    expect(otherInput).toHaveFocus();
  });

  it("stores a typed custom value instead of the sentinel", async () => {
    const user = userEvent.setup();

    render(<SelectHarness initialValue={OTHER_OPTION_VALUE} />);

    const otherInput = screen.getByLabelText("Escribe tu valor");
    await user.click(otherInput);
    await user.paste("Taller de llantas");

    expect(otherInput).toHaveValue("Taller de llantas");
    expect(screen.getByLabelText("Industria / negocio")).toHaveValue(OTHER_OPTION_VALUE);
  });

  it("reloads a saved custom value as Otro plus textbox", () => {
    render(<SelectHarness initialValue="Distribuidora regional" />);

    expect(screen.getByLabelText("Industria / negocio")).toHaveValue(OTHER_OPTION_VALUE);
    expect(screen.getByLabelText("Escribe tu valor")).toHaveValue("Distribuidora regional");
  });

  it("never shows the sentinel inside the text input", () => {
    render(<SelectHarness initialValue={OTHER_OPTION_VALUE} />);

    expect(screen.getByLabelText("Escribe tu valor")).toHaveValue("");
    expect(screen.getByLabelText("Escribe tu valor")).not.toHaveValue(OTHER_OPTION_VALUE);
  });

  it("stores a listed option without showing the custom input", async () => {
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
    expect(screen.queryByLabelText("Escribe tu valor")).not.toBeInTheDocument();
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
