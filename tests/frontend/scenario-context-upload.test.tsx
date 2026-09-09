import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioContextUploadPanel } from "@/app/components/kraken-lab/ScenarioContextUploadPanel";

describe("ScenarioContextUploadPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens the native file picker from the visible upload button", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ScenarioContextUploadPanel
        value={{ text: "" }}
        onChange={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Subir documento" }));

    expect(clickSpy).toHaveBeenCalled();
    expect(screen.getByText("+", { selector: ".scenario-context-upload__plus" })).toBeInTheDocument();
    clickSpy.mockRestore();
  });

  it("renders uploaded files with a remove action", () => {
    render(
      <ScenarioContextUploadPanel
        value={{
          text: "Texto pegado",
          files: [{ id: "f1", name: "brief.txt", text: "Contenido del archivo" }],
        }}
        onChange={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    expect(screen.getByText("brief.txt")).toBeInTheDocument();
    expect(screen.getByText("Texto agregado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });
});
