/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/app/components/AuthForm";
import { AuthScreen } from "@/app/components/AuthScreen";
import { AppShell } from "@/app/components/shell/AppShell";
import { VoiceAuthGate } from "@/app/components/VoiceAuthGate";

vi.mock("@/lib/auth/actions", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({ requiresVoiceAuth: true }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({ session: null }),
}));

afterEach(() => {
  cleanup();
});

describe("a11y surfaces", () => {
  it("announces auth form errors to assistive tech", async () => {
    const user = userEvent.setup();
    render(
      <AuthForm mode="signin" onModeChange={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /Entrar al simulador/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/correo|contraseña/i);
    expect(screen.getByLabelText(/Correo electrónico/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(/Correo electrónico/i)).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
  });

  it("keeps password and voice gates free of a focus trap", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <div>
        <VoiceAuthGate onVerified={vi.fn()} onSkip={onSkip} />
        <button type="button">Después del gate</button>
      </div>,
    );

    expect(screen.getByRole("region", { name: /Acceso a voz/i })).toHaveAttribute(
      "data-no-focus-trap",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Usar voz del navegador/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mostrar contraseña/i }),
    ).toHaveAttribute("aria-label");

    await user.keyboard("{Escape}");
    expect(onSkip).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Después del gate" })).toBeInTheDocument();
  });

  it("exposes a skip link and main target in the app shell", () => {
    render(
      <AppShell
        user={{
          id: "1",
          displayName: "Jaime",
          email: "jaime@equipo",
          initials: "JA",
        }}
        activeTab="train"
        onTabChange={vi.fn()}
      >
        <p>Contenido de práctica</p>
      </AppShell>,
    );

    const skip = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(skip).toHaveAttribute("href", "#contenido");
    expect(document.getElementById("contenido")).toHaveTextContent(
      "Contenido de práctica",
    );
  });

  it("lets the auth screen continue without trapping the user", () => {
    render(
      <AuthScreen onAuthenticated={vi.fn()} onContinueTextOnly={vi.fn()} />,
    );
    expect(
      screen.getByRole("region", { name: /Acceso al simulador/i }),
    ).toHaveAttribute("data-no-focus-trap", "true");
    expect(
      screen.getByRole("button", { name: /Continuar en modo texto/i }),
    ).toBeEnabled();
  });
});
