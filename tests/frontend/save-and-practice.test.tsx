import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulatorApp } from "@/app/components/SimulatorApp";
import { customGymScenarioFixture, marianaScenarioFixture } from "@/tests/frontend/fixtures";
import type { ScenarioRecord } from "@/lib/scenarios/types";

const createScenario = vi.fn();
const getAgentHarness = vi.fn();
const listScenarios = vi.fn();
const saveScenarioVoiceAgent = vi.fn();

const savedValeria: ScenarioRecord = {
  ...customGymScenarioFixture,
  id: "custom-valeria",
  slug: "valeria-soto-kraken-flow",
  clientName: "Valeria Soto",
  clientTitle: "Directora de Compras",
  companyContext: "Importadora del Norte · Monterrey",
  industry: "Importación y distribución",
  productSold: "Kraken Flow — plataforma de flujo comercial B2B",
  clientProblem:
    "Pedidos urgentes se atascan entre ventas y almacén; pierden entregas por falta de visibilidad del pipeline comercial.",
  winCriteria:
    "Mesa de trabajo el jueves a las 10 con compras y operaciones para un piloto de 3 semanas.",
};

vi.mock("@/lib/api/client", () => ({
  listScenarios: (...args: unknown[]) => listScenarios(...args),
  createSession: vi.fn(),
  submitTurn: vi.fn(),
  endSession: vi.fn(),
  createScenario: (...args: unknown[]) => createScenario(...args),
  updateScenario: vi.fn(),
  saveScenarioVoiceAgent: (...args: unknown[]) =>
    saveScenarioVoiceAgent(...args),
  listHistory: vi.fn().mockResolvedValue([]),
  getSessionDetail: vi.fn(),
  getAgentHarness: (...args: unknown[]) => getAgentHarness(...args),
  runAgentChat: vi.fn(),
  listTeams: vi.fn().mockResolvedValue([]),
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

describe("Guardar y practicar", () => {
  beforeEach(() => {
    getAgentHarness.mockResolvedValue({ availability: { hasModel: false } });
    listScenarios.mockResolvedValue([marianaScenarioFixture]);
    saveScenarioVoiceAgent.mockResolvedValue(marianaScenarioFixture);
    createScenario.mockResolvedValue(savedValeria);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("takes a custom example save into Entrenar with the case selected", async () => {
    const user = userEvent.setup();
    listScenarios
      .mockResolvedValueOnce([marianaScenarioFixture])
      .mockResolvedValue([marianaScenarioFixture, savedValeria]);

    render(<SimulatorApp />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Elige un escenario y empieza" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Agente" }));
    expect(
      await screen.findByRole("heading", { name: /Arma el escenario/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cargar Kraken Flow/i }));
    expect(
      await screen.findByRole("heading", { name: /Borrador propuesto/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar y practicar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Elige un escenario y empieza" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Caso listo para practicar.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Arma el escenario/i }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("tab", { name: "Mis escenarios" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: /Escenario Valeria Soto/i }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(createScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Valeria Soto",
        clientPack: expect.objectContaining({
          forbiddenClaims: expect.arrayContaining(["reemplazar el ERP"]),
        }),
      }),
    );
  });
});
