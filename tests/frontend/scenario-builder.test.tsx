import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { draftToCreateInput, emptyAuthoringDraft } from "@/lib/scenarios/authoring";
import { buildAuthoredScenarioConfig } from "@/lib/scenarios/authoring";
import type { ScenarioRecord } from "@/lib/scenarios/types";

vi.mock("@/lib/api/client", () => ({
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

import { createScenario, updateScenario } from "@/lib/api/client";

function savedRecord(): ScenarioRecord {
  const input = draftToCreateInput({
    ...emptyAuthoringDraft("es"),
    industry: "taller de llantas",
    productSold: "llantas premium",
    clientName: "Carlos Ruiz",
    clientTitle: "Dueño",
    companyContext: "Taller Norte",
    clientProblem: "rotación lenta",
    objections: ["Ya tengo proveedor"],
    winCriteria: "Visita al taller el martes a las 10",
  });
  return {
    id: "scenario-1",
    slug: "carlos-taller",
    isPreset: false,
    clientName: input.clientName,
    clientTitle: input.clientTitle,
    companyContext: input.companyContext,
    difficultyLabel: input.difficultyLabel,
    indicator: input.winCriteria.slice(0, 80),
    painPoints: [input.clientProblem, ...input.objections],
    industry: input.industry,
    productSold: input.productSold,
    temperament: input.temperament,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    language: "es",
    config: buildAuthoredScenarioConfig(input),
  };
}

describe("ScenarioBuilderScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates a scenario through persona, beats, and success criteria", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const created = savedRecord();
    vi.mocked(createScenario).mockResolvedValue(created);

    render(<ScenarioBuilderScreen onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/Laura Méndez/i), "Carlos Ruiz");
    await user.type(screen.getByPlaceholderText(/Gerente de sucursal/i), "Dueño");
    await user.type(
      screen.getByPlaceholderText(/Cadena nacional de gimnasios/i),
      "Taller Norte",
    );
    await user.type(
      screen.getByPlaceholderText(/sucursal bancaria/i),
      "taller de llantas",
    );
    await user.type(
      screen.getByPlaceholderText(/membresía premium/i),
      "llantas premium",
    );
    await user.type(
      screen.getByPlaceholderText(/Qué le duele hoy/i),
      "rotación lenta",
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Fases de la llamada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Éxito y puntuación")).toBeInTheDocument();
    expect(screen.getByText("Qué se ve bien (6 dimensiones)")).toBeInTheDocument();

    const win = screen.getByPlaceholderText(/Cita con día y hora/i);
    await user.clear(win);
    await user.type(win, "Visita al taller el martes a las 10");

    await user.click(screen.getByRole("button", { name: "Guardar escenario" }));

    expect(createScenario).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(createScenario).mock.calls[0][0];
    expect(payload.clientName).toBe("Carlos Ruiz");
    expect(payload.winCriteria).toBe("Visita al taller el martes a las 10");
    expect(payload.language).toBe("es");
    expect(payload.rounds?.length).toBeGreaterThanOrEqual(3);
    expect(payload.dimensionGuides?.cierre_siguiente_paso).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith({ scenario: created });
  });

  it("edits an existing scenario and round-trips success criteria", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const existing = savedRecord();
    const updated = {
      ...existing,
      winCriteria: "SPIN Advance: demo en piso el jueves a las 9",
      config: {
        ...existing.config,
        winCriteria: "SPIN Advance: demo en piso el jueves a las 9",
      },
    };
    vi.mocked(updateScenario).mockResolvedValue(updated);

    render(
      <ScenarioBuilderScreen
        initialScenario={existing}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Carlos Ruiz")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const win = screen.getByDisplayValue("Visita al taller el martes a las 10");
    await user.clear(win);
    await user.type(win, "SPIN Advance: demo en piso el jueves a las 9");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(updateScenario).toHaveBeenCalledTimes(1);
    expect(createScenario).not.toHaveBeenCalled();
    const payload = vi.mocked(updateScenario).mock.calls[0][0];
    expect(payload.slug).toBe("carlos-taller");
    expect(payload.winCriteria).toBe(
      "SPIN Advance: demo en piso el jueves a las 9",
    );
    expect(onSave).toHaveBeenCalledWith({ scenario: updated });
  });
});
