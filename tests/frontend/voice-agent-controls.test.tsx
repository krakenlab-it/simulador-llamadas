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
    expect(screen.getByRole("radiogroup", { name: "Ritmo" })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Personalidad" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Interrumpir" })).toBeInTheDocument();
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
