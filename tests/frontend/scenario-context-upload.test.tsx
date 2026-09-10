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

  it("shows saved files banner and filenames after restore", () => {
    render(
      <ScenarioContextUploadPanel
        value={{
          text: "Texto pegado",
          files: [
            { id: "f1", name: "brief.txt", text: "Contenido del archivo" },
            { id: "f2", name: "objeciones.md", text: "" },
          ],
        }}
        onChange={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Ya tienes 2 archivo(s) guardado(s) para este proyecto. ¿Quieres agregar o borrar alguno?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("brief.txt")).toBeInTheDocument();
    expect(screen.getByText("objeciones.md")).toBeInTheDocument();
    expect(screen.getByText("Texto agregado")).toBeInTheDocument();
    expect(screen.getByText("Sin texto extraído")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(2);
  });
});
