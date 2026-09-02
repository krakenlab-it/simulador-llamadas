import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulatorApp } from "@/app/components/SimulatorApp";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";
import type { SessionResponse } from "@/lib/api/stubs";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn(),
  createSession: vi.fn(),
  submitTurn: vi.fn(),
  endSession: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
  listHistory: vi.fn().mockResolvedValue([]),
  getSessionDetail: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    speak: vi.fn(),
    cancel: vi.fn(),
    speaking: false,
  }),
}));

vi.mock("@/lib/hooks/useVoiceSession", () => ({
  useVoiceSession: () => ({
    sessionUsageId: null,
    billedActive: false,
    fallbackToBrowser: true,
    warnLowTime: false,
    remainingConvaiSeconds: 0,
  }),
}));

vi.mock("@/lib/hooks/useConvaiConnection", () => ({
  useConvaiConnection: () => ({
    disconnect: vi.fn(),
    interrupt: vi.fn(),
    connected: false,
    agentSpeaking: false,
    failed: false,
  }),
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

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    requiresVoiceAuth: false,
    convaiEnabled: false,
  }),
}));

import { createSession, listScenarios } from "@/lib/api/client";

describe("session start failure", () => {
  beforeEach(() => {
    vi.mocked(listScenarios).mockResolvedValue([marianaScenarioFixture]);
    vi.mocked(createSession).mockRejectedValue(
      new Error("Servicio no disponible"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows an error toast and stays on setup when createSession fails", async () => {
    const user = userEvent.setup();

    render(<SimulatorApp />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Nueva práctica" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Nueva práctica" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Mariana Escobedo/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("switch", { name: "Modo voz" }));
    await user.click(screen.getByRole("button", { name: "Iniciar llamada" }));

    await waitFor(() => {
      expect(screen.getByText("Servicio no disponible")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", { name: "Elige un escenario y empieza" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Llamada en vivo")).not.toBeInTheDocument();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state on start while the session is starting", async () => {
    let resolveSession: (value: SessionResponse) => void = () => undefined;
    vi.mocked(createSession).mockImplementation(
      () =>
        new Promise<SessionResponse>((resolve) => {
          resolveSession = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<SimulatorApp />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Nueva práctica" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Nueva práctica" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Mariana Escobedo/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("switch", { name: "Modo voz" }));
    await user.click(screen.getByRole("button", { name: "Iniciar llamada" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Iniciar llamada" })).toBeDisabled();
    });

    resolveSession({
      callAttemptId: "stub-1",
      totalRounds: 5,
      traineeId: "t1",
      scenarioSlug: "mariana",
      clientName: "Mariana Escobedo",
      isPreset: true,
      mode: "texto",
      difficultyLevel: 1,
      status: "in_progress",
      currentRound: 1,
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Llamada en vivo")).toBeInTheDocument();
    });
  });
});
