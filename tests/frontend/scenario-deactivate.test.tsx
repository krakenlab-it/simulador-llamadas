/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";
import { customGymScenarioFixture } from "@/tests/frontend/fixtures";

const listScenarios = vi.fn();
const setScenarioActive = vi.fn();
const saveScenarioVoiceAgent = vi.fn();

vi.mock("@/lib/api/client", () => ({
  listScenarios: (...args: unknown[]) => listScenarios(...args),
  setScenarioActive: (...args: unknown[]) => setScenarioActive(...args),
  saveScenarioVoiceAgent: (...args: unknown[]) =>
    saveScenarioVoiceAgent(...args),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    transcript: "",
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    ensureListening: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({ requiresVoiceAuth: false, ttsTier: "browser" }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ session: null }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("ScenarioHub deactivate", () => {
  it("shows Dar de baja for capacitador custom cards", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    listScenarios.mockResolvedValue([
      { ...customGymScenarioFixture, isPreset: false, deactivatedAt: null },
    ]);
    setScenarioActive.mockResolvedValue({
      ...customGymScenarioFixture,
      isPreset: false,
      deactivatedAt: new Date().toISOString(),
    });

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

    await user.click(await screen.findByRole("tab", { name: "Mis escenarios" }));
    expect(
      screen.getByRole("button", { name: "Dar de baja" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dar de baja" }));
    await waitFor(() => {
      expect(setScenarioActive).toHaveBeenCalledWith(
        customGymScenarioFixture.slug,
        false,
      );
    });
  });
});
