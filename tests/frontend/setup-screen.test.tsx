import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import {
  customGymScenarioFixture,
  marianaScenarioFixture,
} from "@/tests/frontend/fixtures";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
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

import { listScenarios, saveScenarioVoiceAgent } from "@/lib/api/client";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  PREMADE_VOICES,
} from "@/lib/voice/agent-settings";

function renderHub(
  props: Partial<React.ComponentProps<typeof ScenarioHub>> = {},
) {
  const onStart = vi.fn();
  const onCreateScenario = vi.fn();
  const onEditScenario = vi.fn();

  render(
    <ScenarioHub
      onStart={onStart}
      onCreateScenario={onCreateScenario}
      onEditScenario={onEditScenario}
      {...props}
    />,
  );

  return { onStart, onCreateScenario, onEditScenario };
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
        phaseLabels: ["Apertura", "Objeción", "Claridad", "Correo", "Cierre"],
      }),
    );
  });

  it("exposes trainer voice knobs on the existing config panel, not a second island", async () => {
    renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    const panel = screen.getByRole("complementary", {
      name: "Configuración de la llamada",
    });
    expect(panel).toBeInTheDocument();
    expect(screen.queryByLabelText(/ajustes del agente/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole("radiogroup", { name: "Idioma" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Voz")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Ritmo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Personalidad" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Interrumpir" })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Dificultad" }),
    ).toBeInTheDocument();
  });

  it("persists knobs on the scenario so a replay starts with the same agent", async () => {
    const user = userEvent.setup();
    vi.mocked(saveScenarioVoiceAgent).mockResolvedValue({
      ...marianaScenarioFixture,
      voiceAgent: {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        language: "en",
        voiceId: PREMADE_VOICES[1].id,
        speakingRate: "lento",
        personality: "esceptico",
        difficultyLevel: 2,
        bargeIn: true,
      },
    });
    const { onStart } = renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("radio", { name: "English" }));
    await user.selectOptions(screen.getByLabelText("Voz"), PREMADE_VOICES[1].id);
    await user.click(screen.getByRole("radio", { name: "Lento" }));
    await user.click(screen.getByRole("radio", { name: "Escéptico" }));
    await user.click(screen.getByRole("radio", { name: "Intermedio" }));
    await user.click(screen.getByRole("switch", { name: "Interrumpir" }));
    await user.click(screen.getByRole("switch", { name: "Modo voz" }));
    await user.click(screen.getByRole("button", { name: "Iniciar llamada" }));

    await waitFor(() => {
      expect(saveScenarioVoiceAgent).toHaveBeenCalledWith(
        "mariana",
        expect.objectContaining({
          language: "en",
          voiceId: PREMADE_VOICES[1].id,
          speakingRate: "lento",
          personality: "esceptico",
          difficultyLevel: 2,
          bargeIn: true,
        }),
      );
    });
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioSlug: "mariana",
        difficultyLevel: 2,
        voiceAgent: expect.objectContaining({
          language: "en",
          voiceId: PREMADE_VOICES[1].id,
          speakingRate: "lento",
          personality: "esceptico",
          bargeIn: true,
        }),
      }),
    );
  });

  it("restores persisted knobs when the trainer picks the same scenario again", async () => {
    const user = userEvent.setup();
    vi.mocked(listScenarios).mockResolvedValue([
      {
        ...marianaScenarioFixture,
        voiceAgent: {
          language: "en",
          voiceId: PREMADE_VOICES[2].id,
          speakingRate: "rapido",
          personality: "impaciente",
          difficultyLevel: 3,
          bargeIn: true,
        },
      },
    ]);

    renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));

    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Voz")).toHaveValue(PREMADE_VOICES[2].id);
    expect(screen.getByRole("radio", { name: "Rápido" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Impaciente" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Avanzado" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Interrumpir" })).toBeChecked();
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

  it("offers edit on custom scenarios and never on clinic presets", async () => {
    vi.mocked(listScenarios).mockResolvedValue([
      marianaScenarioFixture,
      customGymScenarioFixture,
    ]);
    const user = userEvent.setup();
    const { onEditScenario } = renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /Editar Mariana/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Mis escenarios" }));
    await user.click(
      screen.getByRole("button", { name: "Editar Laura Méndez" }),
    );
    expect(onEditScenario).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "laura-gimnasio", isPreset: false }),
    );
  });
});
