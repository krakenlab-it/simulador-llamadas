import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { IndustryTypeSelect } from "@/app/components/ui/IndustryTypeSelect";
import { INDUSTRY_OPTIONS, OTHER_OPTION_VALUE } from "@/lib/scenarios/select-options";

function IndustryHarness({
  initialValue = "",
  onChangeSpy,
}: {
  initialValue?: string;
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <IndustryTypeSelect
      value={value}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
    />
  );
}

describe("IndustryTypeSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows 30 industry options plus Otro in the native select", () => {
    render(<IndustryTypeSelect value="" onChange={vi.fn()} />);

    const select = screen.getByLabelText("Tipo de empresa / industria");
    const optionLabels = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent,
    );

    expect(INDUSTRY_OPTIONS).toHaveLength(30);
    for (const option of INDUSTRY_OPTIONS) {
      expect(optionLabels).toContain(option);
    }
    expect(optionLabels).toContain("Otro");
  });

  it("calls onChange when a listed industry is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IndustryTypeSelect value="" onChange={onChange} />);

    await user.selectOptions(
      screen.getByLabelText("Tipo de empresa / industria"),
      "Logística y transporte",
    );

    expect(onChange).toHaveBeenCalledWith("Logística y transporte");
  });

  it("reveals and focuses the custom input when Otro is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<IndustryHarness onChangeSpy={onChange} />);

    await user.selectOptions(screen.getByLabelText("Tipo de empresa / industria"), "Otro");

    expect(onChange).toHaveBeenCalledWith(OTHER_OPTION_VALUE);
    const root = screen
      .getByLabelText("Tipo de empresa / industria")
      .closest(".industry-type-select");
    const otherInput = within(root as HTMLElement).getByTestId("select-with-other-input");
    expect(otherInput).toBeInTheDocument();
    expect(otherInput).toHaveFocus();
  });

  it("reloads a saved custom industry as Otro plus textbox", () => {
    render(<IndustryHarness initialValue="Taller de llantas" />);

    const root = screen
      .getByLabelText("Tipo de empresa / industria")
      .closest(".industry-type-select") as HTMLElement;

    expect(screen.getByLabelText("Tipo de empresa / industria")).toHaveValue(
      OTHER_OPTION_VALUE,
    );
    expect(within(root).getByTestId("select-with-other-input")).toHaveValue("Taller de llantas");
  });
});
