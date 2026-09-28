/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";
import { customGymScenarioFixture } from "@/tests/frontend/fixtures";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
  setScenarioActive: vi.fn(),
  setScenarioLibraryPublished: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    transcript: "",
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({ requiresVoiceAuth: false, ttsTier: "browser" }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ session: null }),
}));

import { listScenarios } from "@/lib/api/client";

describe("Mis escenarios embedded builder", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the 3-step designer under Mis escenarios when drafts exist", async () => {
    vi.mocked(listScenarios).mockResolvedValue([customGymScenarioFixture]);
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioHub
          hubMode="capacitador"
          onStart={vi.fn()}
          onCreateScenario={vi.fn()}
          onEditScenario={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Escenario Laura Méndez" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar Laura Méndez" }));

    expect(
      screen.getByRole("button", { name: /Perfil del comprador/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Laura Méndez")).toBeInTheDocument();
  });
});
