import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndustryTypeSelect } from "@/app/components/ui/IndustryTypeSelect";
import { INDUSTRY_OPTIONS } from "@/lib/scenarios/select-options";

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
});
