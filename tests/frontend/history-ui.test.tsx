import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HistoryView } from "@/app/components/history/HistoryView";
import * as localHistory from "@/lib/history/local";

describe("HistoryView", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(localHistory, "loadLocalHistory").mockReturnValue([]);
  });

  it("shows empty state when there is no local history", () => {
    render(<HistoryView />);

    expect(screen.getByText("Sin llamadas todavía")).toBeInTheDocument();
    expect(
      screen.getByText(/Completa tu primera simulación/i),
    ).toBeInTheDocument();
  });

  it("shows formatted rows when history exists", () => {
    vi.spyOn(localHistory, "loadLocalHistory").mockReturnValue([
      {
        callAttemptId: "ca-1",
        scenarioSlug: "mariana",
        clientName: "Mariana Escobedo",
        difficultyLevel: 1,
        mode: "texto",
        won: true,
        totalScore: 82,
        turnsCompleted: 5,
        startedAt: "2026-09-01T10:00:00.000Z",
      },
    ]);

    render(<HistoryView />);

    expect(screen.getByText("Mariana Escobedo")).toBeInTheDocument();
    expect(screen.getByText(/1 llamada registrada/i)).toBeInTheDocument();
  });
});
