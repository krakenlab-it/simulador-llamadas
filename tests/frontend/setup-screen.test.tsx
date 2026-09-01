import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
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

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    requiresVoiceAuth: false,
    convaiEnabled: false,
  }),
}));

import { listScenarios } from "@/lib/api/client";

function renderHub(
  props: Partial<React.ComponentProps<typeof ScenarioHub>> = {},
) {
  const onStart = vi.fn();
  const onCreateScenario = vi.fn();

  render(
    <ScenarioHub
      onStart={onStart}
      onCreateScenario={onCreateScenario}
      {...props}
    />,
  );

  return { onStart, onCreateScenario };
}

describe("ScenarioHub flow", () => {
  beforeEach(() => {
    vi.mocked(listScenarios).mockResolvedValue([marianaScenarioFixture]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads scenarios, lets user pick texto mode, and starts a session", async () => {
    const user = userEvent.setup();
    const { onStart } = renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("switch", { name: "Modo voz" }));
    await user.click(screen.getByRole("button", { name: "Iniciar llamada" }));

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

  it("keeps Iniciar llamada disabled until a scenario is selected", async () => {
    renderHub();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Iniciar llamada" })).toBeDisabled();
    });
  });

  it("shows a loading state while scenarios load", () => {
    vi.mocked(listScenarios).mockImplementation(
      () => new Promise(() => undefined),
    );

    renderHub();

    expect(screen.getByText("Cargando escenarios…")).toBeInTheDocument();
  });
});
