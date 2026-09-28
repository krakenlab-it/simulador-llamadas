/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";
import {
  customGymScenarioFixture,
  publishedMarianaLibraryFixture,
} from "@/tests/frontend/fixtures";

const listScenarios = vi.fn();
const setScenarioLibraryPublished = vi.fn();
const saveScenarioVoiceAgent = vi.fn();

vi.mock("@/lib/api/client", () => ({
  listScenarios: (...args: unknown[]) => listScenarios(...args),
  setScenarioLibraryPublished: (...args: unknown[]) =>
    setScenarioLibraryPublished(...args),
  saveScenarioVoiceAgent: (...args: unknown[]) =>
    saveScenarioVoiceAgent(...args),
  setScenarioActive: vi.fn(),
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
});

describe("ScenarioHub biblioteca workflow", () => {
  it("starts with empty Biblioteca when nothing is published", async () => {
    listScenarios.mockResolvedValue([customGymScenarioFixture]);
    render(
      <ToastProvider>
        <ScenarioHub
          onStart={vi.fn()}
          onCreateScenario={vi.fn()}
          onEditScenario={vi.fn()}
        />
      </ToastProvider>,
    );

    await userEvent.setup().click(
      await screen.findByRole("tab", { name: "Biblioteca" }),
    );
    expect(await screen.findByText("Biblioteca vacía")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Laura Méndez/i }),
    ).not.toBeInTheDocument();
  });

  it("shows published scenarios in Biblioteca and Enviar in Mis escenarios", async () => {
    const user = userEvent.setup();
    listScenarios.mockResolvedValue([
      publishedMarianaLibraryFixture,
      customGymScenarioFixture,
    ]);
    setScenarioLibraryPublished.mockResolvedValue({
      ...customGymScenarioFixture,
      libraryPublishedAt: new Date().toISOString(),
    });

    render(
      <ToastProvider>
        <ScenarioHub
          onStart={vi.fn()}
          onCreateScenario={vi.fn()}
          onEditScenario={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole("button", { name: /Escenario Laura Méndez/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar a la biblioteca" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Biblioteca" }));
    expect(
      await screen.findByRole("button", { name: /Mariana Escobedo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Laura Méndez/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Mis escenarios" }));
    await user.click(
      screen.getByRole("button", { name: "Enviar a la biblioteca" }),
    );
    await waitFor(() => {
      expect(setScenarioLibraryPublished).toHaveBeenCalledWith(
        customGymScenarioFixture.slug,
        true,
      );
    });
  });
});
