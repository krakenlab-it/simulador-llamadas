import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentHarnessScreen } from "@/app/components/agent/AgentHarnessScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { stubGetAgentHarness, stubRunAgentChat } from "@/lib/api/stubs";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import type { ScenarioRecord } from "@/lib/scenarios/types";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn(),
  getAgentHarness: vi.fn(),
  runAgentChat: vi.fn(),
  createScenario: vi.fn(),
}));

import {
  createScenario,
  getAgentHarness,
  listScenarios,
  runAgentChat,
} from "@/lib/api/client";

function savedRecord(): ScenarioRecord {
  return {
    id: "scenario-agent",
    slug: "alex-banca",
    isPreset: false,
    clientName: "Alex Rivera",
    clientTitle: "Gerente de sucursal",
    companyContext: "Banco regional",
    difficultyLabel: "Media",
    indicator: "SPIN",
    painPoints: ["No quiere pauta digital"],
    industry: "banca",
    productSold: "pauta digital y captación de cuentas",
    temperament: "Escéptico, poco tiempo",
    clientProblem: "No quiere pauta digital",
    objections: ["No quiere pauta digital"],
    winCriteria: "SPIN Advance",
    language: "es",
    config: {
      industry: "banca",
      productSold: "pauta digital y captación de cuentas",
      clientProblem: "No quiere pauta digital",
      objections: [],
      winCriteria: "SPIN Advance",
      temperament: "Escéptico",
      rounds: [],
      criteria: [],
      globalPositiveCriteria: [],
      openingLines: [],
    },
  };
}

describe("AgentHarnessScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows the default system prompt, accepts a quick edit, and saves a scenario from chat", async () => {
    const user = userEvent.setup();
    const onScenarioSaved = vi.fn();
    vi.mocked(listScenarios).mockResolvedValue([]);
    vi.mocked(getAgentHarness).mockResolvedValue(stubGetAgentHarness());
    vi.mocked(runAgentChat).mockImplementation(stubRunAgentChat);
    vi.mocked(createScenario).mockResolvedValue(savedRecord());

    render(
      <ToastProvider>
        <AgentHarnessScreen onScenarioSaved={onScenarioSaved} />
      </ToastProvider>,
    );

    const prompt = await screen.findByLabelText(/system prompt/i);
    expect(prompt).toHaveValue(DEFAULT_AGENT_SETTINGS.systemPrompt);

    fireEvent.change(prompt, {
      target: { value: "Sé breve y pide día y hora." },
    });
    expect(prompt).toHaveValue("Sé breve y pide día y hora.");

    const composer = screen.getByLabelText(/mensaje para el agente/i);
    await user.type(
      composer,
      "Crea un gerente de banco que no quiere pauta digital",
    );
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/borrador propuesto/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/vende/i).textContent).toMatch(/banca/i);

    await user.click(screen.getByRole("button", { name: /guardar escenario/i }));
    await waitFor(() => {
      expect(createScenario).toHaveBeenCalled();
      expect(onScenarioSaved).toHaveBeenCalledWith("alex-banca");
    });
  });

  it("switches presets from Settings without leaving the happy path", async () => {
    const user = userEvent.setup();
    vi.mocked(listScenarios).mockResolvedValue([]);
    vi.mocked(getAgentHarness).mockResolvedValue(stubGetAgentHarness());

    render(
      <ToastProvider>
        <AgentHarnessScreen onScenarioSaved={vi.fn()} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /comprador difícil/i }));
    const prompt = screen.getByLabelText(/system prompt/i);
    expect((prompt as HTMLTextAreaElement).value).toMatch(/compradores difíciles/i);
  });
});
