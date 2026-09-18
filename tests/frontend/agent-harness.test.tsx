import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentHarnessScreen } from "@/app/components/agent/AgentHarnessScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { emptyAuthoringDraft } from "@/lib/scenarios/authoring";

const runAgentChat = vi.fn();
const createScenario = vi.fn();
const getAgentHarness = vi.fn();
const listScenarios = vi.fn();

vi.mock("@/lib/api/client", () => ({
  runAgentChat: (...args: unknown[]) => runAgentChat(...args),
  createScenario: (...args: unknown[]) => createScenario(...args),
  getAgentHarness: (...args: unknown[]) => getAgentHarness(...args),
  listScenarios: (...args: unknown[]) => listScenarios(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("AgentHarnessScreen", () => {
  it("shows PREFILLED practice cards and keeps the prompt behind advanced", async () => {
    const user = userEvent.setup();
    getAgentHarness.mockResolvedValue({
      availability: { hasModel: false },
    });
    listScenarios.mockResolvedValue([]);
    render(
      <ToastProvider>
        <AgentHarnessScreen
          onScenarioSaved={vi.fn()}
          onPracticePreset={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: /Arma el escenario/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Vercel AI Gateway/i)).toBeInTheDocument();
    expect(screen.getByText(/Hechos del caso/i)).toBeInTheDocument();
    expect(screen.getByText(/Coach aparte/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Cliente en vivo" })).toBeChecked();
    expect(screen.queryByText(/System prompt/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Practicar Mariana Escobedo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ejemplos para armar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cargar Kraken Flow/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cargar Me We/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cargar Wellness/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mostrar todos los ajustes/i }));
    expect(screen.getByText(/System prompt/i)).toBeInTheDocument();
  });

  it("loads a Jaime example pack and saves it as a custom case", async () => {
    const user = userEvent.setup();
    getAgentHarness.mockResolvedValue({ availability: { hasModel: false } });
    listScenarios.mockResolvedValue([]);
    createScenario.mockResolvedValue({ slug: "valeria-soto-kraken-flow" });
    const onPractice = vi.fn();

    render(
      <ToastProvider>
        <AgentHarnessScreen onScenarioSaved={vi.fn()} onPracticePreset={onPractice} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Cargar Kraken Flow/i }));
    expect(
      await screen.findByRole("heading", { name: /Borrador propuesto/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Éxito: Mesa de trabajo el jueves/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar y practicar" }));
    await waitFor(() =>
      expect(onPractice).toHaveBeenCalledWith("valeria-soto-kraken-flow"),
    );
    expect(createScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Valeria Soto",
        productSold: expect.stringMatching(/Kraken Flow/i),
        clientPack: expect.objectContaining({
          forbiddenClaims: expect.arrayContaining(["reemplazar el ERP"]),
        }),
      }),
    );
  });

  it("chats, shows a draft, and saves", async () => {
    const user = userEvent.setup();
    const draft = emptyAuthoringDraft("es");
    draft.clientName = "Laura";
    draft.clientTitle = "Gerente";
    draft.industry = "Banca";
    draft.clientProblem = "No quiere pauta digital";
    getAgentHarness.mockResolvedValue({ availability: { hasModel: false } });
    listScenarios.mockResolvedValue([]);
    runAgentChat.mockResolvedValue({
      assistantMessage: { role: "assistant", content: "Borrador listo" },
      draft,
      traces: [],
      runtime: "local",
      provider: "local",
      state: "proposing",
      roles: { agent: "", user: "", context: "" },
      systemPromptUsed: "",
      contextPack: "",
      appliedInput: null,
      comparison: null,
    });
    createScenario.mockResolvedValue({ slug: "laura-banca" });
    const onSaved = vi.fn();

    render(
      <ToastProvider>
        <AgentHarnessScreen onScenarioSaved={onSaved} onPracticePreset={vi.fn()} />
      </ToastProvider>,
    );

    await user.type(
      screen.getByLabelText(/Mensaje para el agente/i),
      "Crea un gerente de banco que no quiere pauta digital",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { name: /Borrador propuesto/i })).toBeInTheDocument();
    expect(screen.getByText(/Banca —/i)).toBeInTheDocument();

    runAgentChat.mockResolvedValueOnce({
      assistantMessage: { role: "assistant", content: "Guardado" },
      draft,
      traces: [],
      runtime: "local",
      provider: "local",
      state: "ready",
      roles: { agent: "", user: "", context: "" },
      systemPromptUsed: "",
      contextPack: "",
      appliedInput: { clientName: "Laura", industry: "Banca" },
      comparison: null,
    });
    await user.click(screen.getByRole("button", { name: "Guardar escenario" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("laura-banca"));
  });

  it("switches preset and updates the prompt", async () => {
    const user = userEvent.setup();
    getAgentHarness.mockResolvedValue({ availability: { hasModel: false } });
    listScenarios.mockResolvedValue([]);
    render(
      <ToastProvider>
        <AgentHarnessScreen
          onScenarioSaved={vi.fn()}
          onPracticePreset={vi.fn()}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Cierre SPIN" }));
    await user.click(screen.getByRole("button", { name: /Mostrar todos los ajustes/i }));
    expect(
      (screen.getByRole("textbox", { name: /System prompt/i }) as HTMLTextAreaElement)
        .value,
    ).toMatch(/cierre/i);
  });
});
