/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn().mockRejectedValue(new Error("catalog down")),
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
    ensureListening: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({ requiresVoiceAuth: false, ttsTier: "browser" }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ session: null }),
}));

describe("ScenarioHub catalog failure", () => {
  it("shows draft empty state with builder and IA CTAs on Mis escenarios", async () => {
    const onCreateScenario = vi.fn();
    const onOpenIa = vi.fn();
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ScenarioHub
          hubMode="capacitador"
          onStart={vi.fn()}
          onCreateScenario={onCreateScenario}
          onOpenIa={onOpenIa}
          onEditScenario={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole("button", { name: /Perfil del comprador/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Briefing de fases/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cómo se gana/i })).toBeInTheDocument();
    expect(screen.getByText(/No pudimos sincronizar el catálogo remoto/i)).toBeInTheDocument();
    expect(screen.getByText("Antes de marcar")).toBeInTheDocument();
    expect(
      screen.queryByText(/no arrancamos la clínica de respaldo/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Completar con IA (pantalla IA)" }));
    expect(onOpenIa).toHaveBeenCalled();
  });
});
