import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryView } from "@/app/components/history/HistoryView";
import { ToastProvider } from "@/components/ui/Toast";
import * as localHistory from "@/lib/history/local";
import * as apiClient from "@/lib/api/client";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>(
    "@/lib/api/client",
  );
  return {
    ...actual,
    loadHistory: vi.fn(),
  };
});

function renderHistory(props: ComponentProps<typeof HistoryView> = {}) {
  return render(
    <ToastProvider>
      <HistoryView {...props} />
    </ToastProvider>,
  );
}

describe("HistoryView", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(localHistory, "loadLocalHistory").mockReturnValue([]);
    vi.mocked(apiClient.loadHistory).mockResolvedValue({
      entries: [],
      usedLocalFallback: true,
      localReadError: null,
    });
  });

  it("shows empty state when there is no local history", async () => {
    renderHistory({ onStartTraining: () => undefined });

    expect(await screen.findByText("Sin llamadas todavía")).toBeInTheDocument();
    expect(
      screen.getByText(/Completa tu primera simulación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva práctica" }),
    ).toBeInTheDocument();
  });

  it("shows formatted rows when local history exists", async () => {
    vi.mocked(apiClient.loadHistory).mockResolvedValue({
      entries: [
        {
          callAttemptId: "ca-1",
          traineeId: "local",
          scenarioSlug: "mariana",
          clientName: "Mariana Escobedo",
          difficultyLevel: 1,
          mode: "texto",
          status: "completed",
          won: true,
          totalScore: 82,
          startedAt: "2026-09-01T10:00:00.000Z",
          endedAt: null,
          durationSeconds: 180,
          turnsCompleted: 5,
        },
      ],
      usedLocalFallback: true,
      localReadError: null,
    });

    renderHistory();

    expect(await screen.findByText("Mariana Escobedo")).toBeInTheDocument();
    expect(screen.getByText(/1 llamada guardada/i)).toBeInTheDocument();
    expect(screen.getByText("82/100")).toBeInTheDocument();
    expect(screen.getByText("5 turnos")).toBeInTheDocument();
  });

  it("lists a server-scored session and opens detail on tap", async () => {
    vi.mocked(apiClient.loadHistory).mockResolvedValue({
      entries: [
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
      ],
      usedLocalFallback: false,
      localReadError: null,
    });
    const onOpenCall = vi.fn();

    renderHistory({
      traineeEmail: "seb@example.com",
      onStartTraining: () => undefined,
      onOpenCall,
    });

    expect(await screen.findByText("Mariana Escobedo")).toBeInTheDocument();
    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(screen.getByText("4 min")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Mariana Escobedo/i }),
    );
    expect(onOpenCall).toHaveBeenCalledWith("ca-server");
  });

  it("shows local rows without a red error when server history falls back", async () => {
    vi.mocked(apiClient.loadHistory).mockResolvedValue({
      entries: [
        {
          callAttemptId: "ca-local",
          traineeId: "local",
          scenarioSlug: "mariana",
          clientName: "Mariana Escobedo",
          difficultyLevel: 1,
          mode: "texto",
          status: "completed",
          won: false,
          totalScore: 64,
          startedAt: "2026-09-03T10:00:00.000Z",
          endedAt: null,
          durationSeconds: 120,
          turnsCompleted: 4,
        },
      ],
      usedLocalFallback: true,
      localReadError: null,
    });

    renderHistory({ traineeEmail: "seb@example.com" });

    expect(await screen.findByText("Mariana Escobedo")).toBeInTheDocument();
    expect(
      screen.queryByText("No se pudo cargar tu historial. Intenta de nuevo."),
    ).not.toBeInTheDocument();
  });

  it("shows empty state without red error when remote and local history are empty", async () => {
    vi.mocked(apiClient.loadHistory).mockResolvedValue({
      entries: [],
      usedLocalFallback: true,
      localReadError: null,
    });

    renderHistory({ traineeEmail: "seb@example.com" });

    expect(await screen.findByText("Sin llamadas todavía")).toBeInTheDocument();
    expect(
      screen.queryByText("No se pudo cargar tu historial. Intenta de nuevo."),
    ).not.toBeInTheDocument();
  });
});
