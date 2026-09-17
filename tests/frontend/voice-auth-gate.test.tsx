import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { VoiceAuthGate } from "@/app/components/VoiceAuthGate";

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1", email: "preview@krakenlab.it" } },
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
  }),
}));

describe("VoiceAuthGate", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not trap a valid session behind a verify-email error", async () => {
    const onVerified = vi.fn();
    const onSkip = vi.fn();
    render(<VoiceAuthGate onVerified={onVerified} onSkip={onSkip} />);

    await waitFor(() => {
      expect(
        screen.queryByText("No se pudo verificar la sesión para voz facturada."),
      ).not.toBeInTheDocument();
    });
    expect(onVerified).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Usar voz del navegador" }),
    ).toBeInTheDocument();
  });
});
