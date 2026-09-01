import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupScreen } from "@/app/components/SetupScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";

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

function renderSetup(
  props: Partial<React.ComponentProps<typeof SetupScreen>> = {},
) {
  const onStart = vi.fn();
  const onCreateScenario = vi.fn();

  render(
    <ToastProvider>
      <SetupScreen
        onStart={onStart}
        onCreateScenario={onCreateScenario}
        {...props}
      />
    </ToastProvider>,
  );

  return { onStart, onCreateScenario };
}

describe("SetupScreen flow", () => {
  beforeEach(() => {
    vi.mocked(listScenarios).mockResolvedValue([marianaScenarioFixture]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads scenarios, lets user pick texto mode, and starts a session", async () => {
    const user = userEvent.setup();
    const { onStart } = renderSetup();

    expect(document.querySelectorAll(".skeleton-card").length).toBe(3);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("button", { name: "Texto" }));
    await user.click(screen.getByRole("button", { name: "Marcar" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioSlug: "mariana",
        clientName: "Mariana Escobedo",
        mode: "texto",
        difficultyLevel: 1,
        totalRounds: 5,
      }),
    );
  });

  it("keeps Marcar disabled until a scenario is selected", async () => {
    renderSetup();
    const setup = screen.getByLabelText("Configuración de la práctica");

    await waitFor(() => {
      expect(within(setup).getByRole("button", { name: "Marcar" })).toBeDisabled();
    });
  });

  it("shows skeleton placeholders while scenarios load", () => {
    vi.mocked(listScenarios).mockImplementation(
      () => new Promise(() => undefined),
    );

    renderSetup();

    const skeletonCards = document.querySelectorAll(".skeleton-card");
    expect(skeletonCards.length).toBe(3);
  });

  it("shows an error toast when scenario loading fails", async () => {
    vi.mocked(listScenarios).mockRejectedValue(new Error("network down"));

    renderSetup();

    await waitFor(() => {
      expect(
        within(screen.getByLabelText("Configuración de la práctica")).getByRole(
          "alert",
        ),
      ).toHaveTextContent("No se pudieron cargar los escenarios.");
    });

    expect(screen.getAllByText("No se pudieron cargar los escenarios.").length).toBeGreaterThanOrEqual(1);
  });
});
