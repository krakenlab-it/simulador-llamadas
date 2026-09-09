import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectWithOther } from "@/app/components/ui/SelectWithOther";

describe("SelectWithOther", () => {
  afterEach(() => {
    cleanup();
  });

  it("reveals a custom input when Otro is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SelectWithOther
        label="Industria / negocio"
        value=""
        options={["Retail", "Banca y servicios financieros"]}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Industria / negocio"), "Otro");

    expect(screen.getByPlaceholderText("Escribe tu valor")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Escribe tu valor"), "Taller de llantas");
    expect(onChange).toHaveBeenCalled();
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
    expect(screen.queryByPlaceholderText("Escribe tu valor")).not.toBeInTheDocument();
  });
});
