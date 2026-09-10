import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioHub } from "@/app/components/training/ScenarioHub";
import { ToastProvider } from "@/components/ui/Toast";
import { marianaScenarioFixture } from "@/tests/frontend/fixtures";

vi.mock("@/lib/auth/context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    session: {
      user: {
        id: "preview-user",
        email: "preview@krakenlab.it",
        email_confirmed_at: null,
      },
    },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/voice-session", () => ({
  registerVerifiedVoiceUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    requiresVoiceAuth: true,
    convaiEnabled: false,
    ttsTier: "elevenlabs",
  }),
}));

vi.mock("@/lib/api/client", () => ({
  loadScenarioCatalog: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    transcript: "hola",
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
    appendToField: (current: string) => current,
  }),
}));

import { loadScenarioCatalog, saveScenarioVoiceAgent } from "@/lib/api/client";

function renderHub() {
  const onStart = vi.fn();
  render(
    <ToastProvider>
      <ScenarioHub
        onStart={onStart}
        onOpenKrakenWizard={vi.fn()}
        onOpenAgenticPanel={vi.fn()}
        onCreateScenario={vi.fn()}
        onEditScenario={vi.fn()}
      />
    </ToastProvider>,
  );
  return { onStart };
}

describe("billed voice session gate", () => {
  beforeEach(() => {
    vi.mocked(loadScenarioCatalog).mockResolvedValue({
      scenarios: [marianaScenarioFixture],
      usedLocalFallback: false,
    });
    vi.mocked(saveScenarioVoiceAgent).mockResolvedValue({
      scenario: marianaScenarioFixture,
      usedLocalFallback: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets a logged-in user start billed voice without email verification", async () => {
    const user = userEvent.setup();
    const { onStart } = renderHub();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mariana Escobedo/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mariana Escobedo/i }));
    await user.click(screen.getByRole("button", { name: "Probar micrófono" }));

    expect(
      screen.queryByText("No se pudo verificar la sesión para voz facturada."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Verifica tu correo para usar voz con facturación."),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Acceso a voz con IA")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Iniciar llamada" }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });
    expect(onStart.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        mode: "voz",
        scenarioSlug: marianaScenarioFixture.slug,
      }),
    );
    expect(screen.queryByText(/sin facturación ElevenLabs/i)).not.toBeInTheDocument();
  });
});
