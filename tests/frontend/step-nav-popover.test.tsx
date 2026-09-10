import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepNavPopover } from "@/app/components/ui/StepNavPopover";

describe("StepNavPopover", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows draft summary in tooltip on hover and focus", async () => {
    const user = userEvent.setup();
    render(
      <ol className="wizard-steps">
        <StepNavPopover
          variant="wizard"
          stepNumber={2}
          label="Tamaño del grupo"
          summary="2 participante(s) · Modo Texto"
          onSelect={vi.fn()}
        />
      </ol>,
    );

    const button = screen.getByRole("button", { name: /2\. Tamaño del grupo/i });
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent("2 participante(s) · Modo Texto");
    expect(tooltip).not.toHaveClass("step-nav-popover--open");

    await user.hover(button);
    expect(tooltip).toHaveClass("step-nav-popover--open");

    await user.unhover(button);
    await user.tab();
    expect(button).toHaveFocus();
    expect(tooltip).toHaveClass("step-nav-popover--open");
  });

  it("navigates when the step pill is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ol className="builder-steps">
        <StepNavPopover
          variant="builder"
          stepNumber={1}
          label="Cliente"
          hint="Quién es el cliente"
          summary="Ana López · Retail"
          onSelect={onSelect}
        />
      </ol>,
    );

    await user.click(screen.getByRole("button", { name: /^1[\s\S]*Cliente/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows muted empty state when summary is blank", async () => {
    const user = userEvent.setup();
    render(
      <ol className="wizard-steps">
        <StepNavPopover
          variant="wizard"
          stepNumber={7}
          label="Personas receptoras"
          summary=""
          onSelect={vi.fn()}
        />
      </ol>,
    );

    const button = screen.getByRole("button", { name: /7\. Personas receptoras/i });
    await user.hover(button);
    expect(screen.getByRole("tooltip")).toHaveClass("step-nav-popover--empty");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Aún sin completar");
  });
});
