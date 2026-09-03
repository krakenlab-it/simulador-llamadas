import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsScreen } from "@/app/components/results/ResultsScreen";

describe("ResultsScreen hang-up failure", () => {
  it("shows recovery actions instead of an infinite spinner when scoring never arrives", async () => {
    const onRepeat = vi.fn();
    const onNewScenario = vi.fn();
    const onViewHistory = vi.fn();
    const user = userEvent.setup();

    render(
      <ResultsScreen
        result={null}
        turns={[]}
        clientName="Mariana Escobedo"
        scenarioSlug="mariana"
        totalRounds={5}
        loading={false}
        onRepeat={onRepeat}
        onNewScenario={onNewScenario}
        onViewHistory={onViewHistory}
        historyActionLabel="Volver al inicio"
      />,
    );

    expect(
      screen.getByText("No se pudo generar la evaluación"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Generando tu evaluación y coaching…"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Repetir con Mariana Escobedo" }));
    await user.click(screen.getByRole("button", { name: "Otro escenario" }));
    await user.click(screen.getByRole("button", { name: "Volver al inicio" }));

    expect(onRepeat).toHaveBeenCalledTimes(1);
    expect(onNewScenario).toHaveBeenCalledTimes(1);
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps the generating spinner while the scorecard is still loading", () => {
    render(
      <ResultsScreen
        result={null}
        turns={[]}
        clientName="Mariana Escobedo"
        scenarioSlug="mariana"
        totalRounds={5}
        loading
        onRepeat={vi.fn()}
        onNewScenario={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Generando tu evaluación y coaching…"),
    ).toBeInTheDocument();
  });
});
