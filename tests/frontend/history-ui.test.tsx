import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupScreen } from "@/app/components/SetupScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";
import * as localHistory from "@/lib/history/local";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    transcript: "",
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
    appendToField: (current: string) => current,
  }),
}));

import { listScenarios } from "@/lib/api/client";

function renderSetup() {
  render(
    <ToastProvider>
      <SetupScreen onStart={vi.fn()} onCreateScenario={vi.fn()} />
    </ToastProvider>,
  );
}

describe("history panel", () => {
  beforeEach(() => {
    vi.mocked(listScenarios).mockResolvedValue([marianaScenarioFixture]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows empty state when there is no local history", async () => {
    vi.spyOn(localHistory, "loadLocalHistorySafe").mockReturnValue({
      entries: [],
      error: null,
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ver historial" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Ver historial" }));
    await vi.advanceTimersByTimeAsync(150);

    await waitFor(() => {
      expect(
        screen.getByText("Sin llamadas guardadas en este dispositivo."),
      ).toBeInTheDocument();
    });
  });

  it("shows an error message when history cannot be read", async () => {
    vi.spyOn(localHistory, "loadLocalHistorySafe").mockReturnValue({
      entries: [],
      error: "El historial guardado está dañado.",
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ver historial" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Ver historial" }));
    await vi.advanceTimersByTimeAsync(150);

    await waitFor(() => {
      expect(
        screen.getByText("El historial guardado está dañado."),
      ).toBeInTheDocument();
    });
  });

  it("shows a loading state while history is being read", async () => {
    vi.spyOn(localHistory, "loadLocalHistorySafe").mockReturnValue({
      entries: [],
      error: null,
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ver historial" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Ver historial" }));

    expect(screen.getByText("Cargando historial…")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(150);

    await waitFor(() => {
      expect(
        screen.getByText("Sin llamadas guardadas en este dispositivo."),
      ).toBeInTheDocument();
    });
  });
});
