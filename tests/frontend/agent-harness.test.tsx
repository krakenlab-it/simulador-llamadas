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
  it("shows the system prompt and PREFILLED practice cards", async () => {
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
    expect(screen.getByText(/System prompt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Practicar Mariana Escobedo/i }),
    ).toBeInTheDocument();
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
    expect(await screen.findByText(/Borrador propuesto/i)).toBeInTheDocument();
    expect(screen.getByText(/Laura/)).toBeInTheDocument();

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
    expect(
      (screen.getByRole("textbox", { name: /System prompt/i }) as HTMLTextAreaElement)
        .value,
    ).toMatch(/cierre/i);
  });
});
