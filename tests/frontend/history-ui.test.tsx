import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryView } from "@/app/components/history/HistoryView";
import * as localHistory from "@/lib/history/local";
import * as apiClient from "@/lib/api/client";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>(
    "@/lib/api/client",
  );
  return {
    ...actual,
    listHistory: vi.fn(),
  };
});

describe("HistoryView", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(localHistory, "loadLocalHistory").mockReturnValue([]);
    vi.mocked(apiClient.listHistory).mockResolvedValue([]);
  });

  it("shows empty state when there is no local history", async () => {
    render(<HistoryView onStartTraining={() => undefined} />);

    expect(await screen.findByText("Sin llamadas todavía")).toBeInTheDocument();
    expect(
      screen.getByText(/Completa tu primera simulación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva práctica" }),
    ).toBeInTheDocument();
  });

  it("shows formatted rows when local history exists", async () => {
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
        durationSeconds: 180,
      },
    ]);

    render(<HistoryView />);

    expect(await screen.findByText("Mariana Escobedo")).toBeInTheDocument();
    expect(screen.getByText(/1 llamada guardada/i)).toBeInTheDocument();
    expect(screen.getByText("82/100")).toBeInTheDocument();
    expect(screen.getByText("5 turnos")).toBeInTheDocument();
  });

  it("lists a server-scored session and opens detail on tap", async () => {
    vi.mocked(apiClient.listHistory).mockResolvedValue([
      {
        callAttemptId: "ca-server",
        traineeId: "tr-1",
        scenarioSlug: "mariana",
        clientName: "Mariana Escobedo",
        difficultyLevel: 2,
        mode: "texto",
        status: "completed",
        won: true,
        totalScore: 76,
        startedAt: "2026-09-02T10:00:00.000Z",
        endedAt: "2026-09-02T10:04:00.000Z",
        durationSeconds: 240,
        turnsCompleted: 5,
      },
    ]);
    const onOpenCall = vi.fn();

    render(
      <HistoryView
        traineeEmail="seb@example.com"
        onStartTraining={() => undefined}
        onOpenCall={onOpenCall}
      />,
    );

    expect(await screen.findByText("Mariana Escobedo")).toBeInTheDocument();
    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(screen.getByText("4 min")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Mariana Escobedo/i }),
    );
    expect(onOpenCall).toHaveBeenCalledWith("ca-server");
  });
});
