import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";
import type { TurnResponse } from "@/lib/api/stubs";
import { TURN_FEEDBACK_AUTO_COLLAPSE_MS } from "@/lib/call/turn-feedback";
import { AUTOSUBMIT_SILENCE_MS } from "@/lib/voice/timeouts";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

/** Ordered record of the voice side effects a mic click triggers. */
const voiceCalls = vi.hoisted(() => ({ order: [] as string[] }));

const speak = vi.fn();
const cancel = vi.fn(() => {
  voiceCalls.order.push("cancel");
});

vi.mock("@/lib/voice/client-playback", () => ({
  unlockClientPlayback: vi.fn(() => {
    voiceCalls.order.push("unlock");
  }),
}));

const speechState = vi.hoisted(() => ({
  supported: true,
  listening: false,
  transcript: "",
  error: null as string | null,
  sttTier: "browser",
  startListening: vi.fn(),
  stopListening: vi.fn(),
  resetTranscript: vi.fn(),
  ensureListening: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  submitTurn: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    ttsTier: "elevenlabs",
    traces: [],
    speak,
    cancel,
  }),
}));

vi.mock("@/lib/hooks/useVoiceSession", () => ({
  useVoiceSession: () => ({
    sessionUsageId: "usage-1",
    verifiedUserId: "user-1",
    billedActive: true,
    remainingConvaiSeconds: 180,
    warnLowTime: false,
    fallbackToBrowser: false,
  }),
}));

const convaiFns = vi.hoisted(() => ({
  disconnect: vi.fn(),
  interrupt: vi.fn(),
}));

// ConvAI stays disconnected for every test here: the call must work anyway.
vi.mock("@/lib/hooks/useConvaiConnection", () => ({
  useConvaiConnection: () => ({
    connected: false,
    agentSpeaking: false,
    failed: false,
    disconnect: convaiFns.disconnect,
    interrupt: convaiFns.interrupt,
  }),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => speechState,
}));

vi.mock("@/lib/hooks/useCallAudioDevices", () => ({
  useCallAudioDevices: () => ({
    ready: false,
    speakerSupported: false,
    inputs: [],
    outputs: [],
    selectedMicId: "",
    selectedSpeakerId: "",
    micCaptureNote: null,
    refreshDevices: vi.fn(),
    selectMic: vi.fn(),
    selectSpeaker: vi.fn(),
    releaseMic: vi.fn(),
  }),
}));

const convaiEnabled = { value: false };

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    sttTier: "browser",
    ttsTier: "elevenlabs",
    convaiEnabled: convaiEnabled.value,
    serverTts: true,
    serverStt: false,
    requiresVoiceAuth: true,
    elevenlabsBilledAvailable: true,
    pronunciationDictionary: true,
    brakes: {},
  }),
}));

import { submitTurn } from "@/lib/api/client";

const CLIENT_REPLY = "Entiendo, cuéntame cómo lo miden ustedes.";

function turnResponse(overrides: Partial<TurnResponse> = {}): TurnResponse {
  return {
    turnId: "turn-1",
    roundNumber: 1,
    roundType: "apertura",
    roundKey: "apertura",
    roundLabel: "Apertura",
    traineeUtterance: "Hola, hablo de parte de KrakenLab.",
    roundScore: 70,
    keywordHits: {},
    clientReaction: "bien",
    clientReply: CLIENT_REPLY,
    feedback: "Buena apertura.",
    richFeedback: {
      score: 70,
      utterance: "Hola, hablo de parte de KrakenLab.",
      whyScore: "Nombraste el problema.",
      strongerLine: "Menciona la métrica.",
      missedCriteria: [],
      roundLabel: "Apertura",
    },
    hasConcreteDayAndTime: false,
    won: false,
    ...overrides,
  };
}

function callScreen(
  overrides: Partial<React.ComponentProps<typeof LiveCallScreen>> = {},
) {
  return (
    <ToastProvider>
      <LiveCallScreen
        callAttemptId="call-1"
        clientName="Mariana Escobedo"
        scenarioSlug="mariana"
        isPreset={false}
        mode="voz"
        level={2}
        totalRounds={5}
        onHangUp={vi.fn()}
        {...overrides}
      />
    </ToastProvider>
  );
}

function renderCall() {
  return render(callScreen());
}

describe("live call voice path without ConvAI", () => {
  beforeEach(() => {
    convaiEnabled.value = false;
    voiceCalls.order.length = 0;
    speechState.listening = false;
    speechState.transcript = "";
    speechState.error = null;
    speechState.resetTranscript.mockImplementation(() => {
      speechState.transcript = "";
      speechState.error = null;
    });
    vi.mocked(submitTurn).mockResolvedValue(turnResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  it("speaks the opening line when the call starts in voz", async () => {
    renderCall();

    await waitFor(() => {
      expect(speak).toHaveBeenCalledTimes(1);
    });
    expect(speak.mock.calls[0][0]).toBeTruthy();
    expect(
      screen.queryByText(/sin facturación ElevenLabs/i),
    ).not.toBeInTheDocument();
  });

  it("shows and speaks the client reply returned by the turn", async () => {
    const user = userEvent.setup();
    renderCall();

    await user.type(
      screen.getByLabelText("Tu respuesta"),
      "Hola, hablo de parte de KrakenLab.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(screen.getByText(CLIENT_REPLY)).toBeInTheDocument();
    });
    expect(speak).toHaveBeenCalledWith(CLIENT_REPLY);
  });

  it("sends one turn per click even when the button is hit twice", async () => {
    const user = userEvent.setup();
    let resolveTurn: (value: TurnResponse) => void = () => undefined;
    vi.mocked(submitTurn).mockImplementation(
      () =>
        new Promise<TurnResponse>((resolve) => {
          resolveTurn = resolve;
        }),
    );

    renderCall();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    const send = screen.getByRole("button", { name: "Enviar turno" });
    await user.click(send);
    await user.click(send);
    await user.click(send);

    expect(submitTurn).toHaveBeenCalledTimes(1);

    resolveTurn(turnResponse());
    await waitFor(() => {
      expect(screen.getByText(CLIENT_REPLY)).toBeInTheDocument();
    });
    expect(submitTurn).toHaveBeenCalledTimes(1);
  });

  it("keeps the round and reuses the idempotency key after a failure", async () => {
    const user = userEvent.setup();
    vi.mocked(submitTurn).mockRejectedValueOnce(
      new Error("No se pudo registrar el turno. Intenta de nuevo."),
    );

    renderCall();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(
        screen.getByText("No se pudo registrar el turno. Intenta de nuevo."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Ronda 1/5 · Apertura")).toBeInTheDocument();
    expect(submitTurn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(submitTurn).toHaveBeenCalledTimes(2);
    });
    const [firstCall, retryCall] = vi.mocked(submitTurn).mock.calls;
    expect(retryCall[1].clientTurnId).toBe(firstCall[1].clientTurnId);
  });

  it("autosubmits after end-of-speech silence and does not double-post", async () => {
    vi.useFakeTimers();
    const view = renderCall();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Micrófono" }));
    });
    speechState.listening = true;
    await act(async () => {
      view.rerender(callScreen());
    });

    speechState.transcript = "Hola Mariana, hablo de KrakenLab.";
    speechState.listening = false;
    await act(async () => {
      view.rerender(callScreen());
    });

    expect(submitTurn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTOSUBMIT_SILENCE_MS);
    });

    expect(submitTurn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitTurn).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        utterance: "Hola Mariana, hablo de KrakenLab.",
        clientTurnId: expect.any(String),
      }),
    );

    await act(async () => {
      view.rerender(callScreen());
    });
    expect(submitTurn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancels speech before unlocking so a line waiting on the gesture survives", async () => {
    renderCall();
    await waitFor(() => {
      expect(speak).toHaveBeenCalled();
    });
    voiceCalls.order.length = 0;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Micrófono" }));
    });

    // Unlocking flushes any pending line; cancelling after it would kill the
    // line the click just released.
    expect(voiceCalls.order).toEqual(["cancel", "unlock"]);
  });

  it("does not show Escuchando when recognition is not listening", async () => {
    const user = userEvent.setup();
    const view = renderCall();

    await user.click(screen.getByRole("button", { name: "Micrófono" }));
    speechState.listening = false;
    view.rerender(callScreen());

    expect(
      screen.queryByRole("button", { name: "Escuchando…" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reanudando micrófono…" }),
    ).toBeInTheDocument();
  });

  it("does not autosubmit empty or no-speech results", async () => {
    const user = userEvent.setup();
    const view = renderCall();

    await user.click(screen.getByRole("button", { name: "Micrófono" }));
    speechState.transcript = "";
    speechState.listening = false;
    speechState.error = null;
    view.rerender(callScreen());

    expect(submitTurn).not.toHaveBeenCalled();
    expect(screen.queryByText(/Error de micrófono: no-speech/i)).not.toBeInTheDocument();
  });

  it("does not autosubmit very short false-starts", async () => {
    vi.useFakeTimers();
    const view = renderCall();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Micrófono" }));
    });
    speechState.listening = true;
    await act(async () => {
      view.rerender(callScreen());
    });

    speechState.transcript = "Hola";
    speechState.listening = false;
    await act(async () => {
      view.rerender(callScreen());
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTOSUBMIT_SILENCE_MS);
    });

    expect(submitTurn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("falls back to browser mic and TTS when ConvAI is enabled but not connected", async () => {
    convaiEnabled.value = true;
    const user = userEvent.setup();

    renderCall();

    expect(
      screen.getByRole("button", { name: "Micrófono" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Agente de voz no conectado/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/sin facturación ElevenLabs/i),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(CLIENT_REPLY);
    });
  });

  it("keeps Advanced closed by default and open after the next turn starts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <LiveCallScreen
          callAttemptId="call-1"
          clientName="Mariana Escobedo"
          scenarioSlug="mariana"
          isPreset={false}
          mode="voz"
          level={2}
          totalRounds={5}
          voiceAgent={{ ...DEFAULT_VOICE_AGENT_SETTINGS, advancedOpen: true }}
          onHangUp={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(screen.getByLabelText("Voz")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ritmo" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Voz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avanzado/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps coaching on screen after the next turn starts", async () => {
    const user = userEvent.setup();
    renderCall();

    await user.type(
      screen.getByLabelText("Tu respuesta"),
      "Hola, hablo de parte de KrakenLab.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.getByRole("progressbar")).toHaveAttribute(
          "aria-valuenow",
          "2",
        );
      },
      { timeout: 3000 },
    );
    expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
  });

  it("lists prior-turn coaching in a scrollable history", async () => {
    const user = userEvent.setup();
    vi.mocked(submitTurn)
      .mockResolvedValueOnce(turnResponse())
      .mockResolvedValueOnce(
        turnResponse({
          turnId: "turn-2",
          roundNumber: 2,
          roundKey: "objecion",
          roundType: "objecion",
          roundLabel: "Objeción",
          richFeedback: {
            score: 74,
            utterance: "¿Cómo miden las visitas?",
            whyScore: "Pediste la métrica.",
            strongerLine: "Ancla el dolor.",
            missedCriteria: [],
            roundLabel: "Objeción",
          },
        }),
      );

    renderCall();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));
    await waitFor(() => {
      expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Tu respuesta"), "¿Cómo miden las visitas?");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));
    await waitFor(() => {
      expect(screen.getByText("Pediste la métrica.")).toBeInTheDocument();
    });

    const history = screen.getByRole("list", { name: /historial de coaching/i });
    expect(history).toBeInTheDocument();
    expect(history.textContent).toContain("Nombraste el problema.");
    expect(history.textContent).toContain("Pediste la métrica.");
  });

  it("auto-collapses unread coaching without deleting history", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCall();

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana.");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));
    await waitFor(() => {
      expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /ocultar coaching|cerrar coaching/i }),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(TURN_FEEDBACK_AUTO_COLLAPSE_MS);
    });

    expect(screen.queryByText("Nombraste el problema.")).not.toBeInTheDocument();
    const history = screen.getByRole("list", { name: /historial de coaching/i });
    expect(history.textContent).toMatch(/Apertura/);
    expect(
      screen.getByRole("button", { name: /mostrar coaching|abrir coaching/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /mostrar coaching|abrir coaching/i }),
    );
    expect(screen.getByText("Nombraste el problema.")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
