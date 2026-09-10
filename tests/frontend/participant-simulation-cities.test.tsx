import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantSimulationCitiesField } from "@/app/components/kraken-lab/ParticipantSimulationCitiesField";

describe("ParticipantSimulationCitiesField", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps a trailing comma visible while typing and parses on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ParticipantSimulationCitiesField country="México" cities={[]} onChange={onChange} />,
    );

    const input = screen.getByLabelText("Ciudades de simulación (separadas por coma)");
    await user.type(input, "Monterrey,");

    expect(input).toHaveValue("Monterrey,");
    expect(onChange).not.toHaveBeenCalled();

    await user.tab();

    expect(onChange).toHaveBeenCalledWith({
      country: "México",
      cities: ["Monterrey"],
    });
  });

  it("adds cities from the country picker chips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ParticipantSimulationCitiesField country="México" cities={[]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("option", { name: "Monterrey" }));

    expect(onChange).toHaveBeenCalledWith({
      country: "México",
      cities: ["Monterrey"],
    });
  });
});
