import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api/client", () => ({
  listScenarios: vi.fn().mockResolvedValue([]),
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
    ensureListening: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    requiresVoiceAuth: false,
    ttsTier: "browser",
  }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ session: null }),
}));

describe("ScenarioHub UX", () => {
  it("shows Entrenar-first hero and empty buyer summary", async () => {
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
      screen.getByRole("heading", { name: /Practica la llamada antes de marcar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Elige un escenario para ver el perfil del comprador/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Antes de marcar")).toBeInTheDocument();
  });
});
