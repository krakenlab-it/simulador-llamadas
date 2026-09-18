import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceAgentControls } from "@/app/components/training/VoiceAgentControls";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

function renderControls(
  overrides: Partial<typeof DEFAULT_VOICE_AGENT_SETTINGS> = {},
) {
  const onChange = vi.fn();
  render(
    <VoiceAgentControls
      value={{ ...DEFAULT_VOICE_AGENT_SETTINGS, ...overrides }}
      onChange={onChange}
      showBargeIn
    />,
  );
  return { onChange };
}

describe("VoiceAgentControls Advanced toggle", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows language on the default row and hides the rest", () => {
    renderControls();

    expect(screen.getByRole("radiogroup", { name: "Idioma" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Género de voz" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Cliente en vivo" })).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Tono del cliente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avanzado/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByLabelText("Voz")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ritmo" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Personalidad" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Interrumpir" })).not.toBeInTheDocument();
  });

  it("reveals voice, rate, personality, and barge-in when Advanced is open", () => {
    renderControls({ advancedOpen: true });

    expect(screen.getByRole("button", { name: /avanzado/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText("Voz")).toBeInTheDocument();
    expect(screen.getByLabelText("Conexión ElevenLabs")).toBeInTheDocument();
    expect(screen.getByText(/ELEVENLABS_API_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/ELEVENLABS_VOICE_ID_FEMALE_A/)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Ritmo" })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Personalidad" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Interrumpir" })).toBeInTheDocument();
  });

  it("lets the trainer flip the live motor and tone without opening Advanced", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();

    await user.click(screen.getByRole("switch", { name: "Cliente en vivo" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        clientLayer: expect.objectContaining({ motorEnabled: false }),
      }),
    );

    await user.click(screen.getByRole("radio", { name: "Desconfiado" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        clientLayer: expect.objectContaining({ toneId: "desconfianza" }),
      }),
    );
  });

  it("persists Advanced open through onChange so the session can keep it", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();

    await user.click(screen.getByRole("button", { name: /avanzado/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ advancedOpen: true }),
    );
  });
});
