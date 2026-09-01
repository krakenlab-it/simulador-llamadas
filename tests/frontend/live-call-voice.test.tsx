import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";
import type { TurnResponse } from "@/lib/api/stubs";

const speak = vi.fn();
const cancel = vi.fn();

const speechState = vi.hoisted(() => ({
  supported: true,
  listening: false,
  transcript: "",
  error: null as string | null,
  sttTier: "browser",
  startListening: vi.fn(),
  stopListening: vi.fn(),
  resetTranscript: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  submitTurn: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    ttsTier: "elevenlabs",
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

// ConvAI stays disconnected for every test here: the call must work anyway.
vi.mock("@/lib/hooks/useConvaiConnection", () => ({
  useConvaiConnection: () => ({
    connected: false,
    agentSpeaking: false,
    failed: false,
    disconnect: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => speechState,
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

function callScreen() {
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

  it("autosubmits when recognition ends with a transcript and does not double-post", async () => {
    const user = userEvent.setup();
    const view = renderCall();

    await user.click(screen.getByRole("button", { name: "Micrófono" }));
    expect(screen.getByRole("button", { name: "Escuchando…" })).toBeInTheDocument();

    speechState.transcript = "Hola Mariana, hablo de KrakenLab.";
    speechState.listening = false;
    view.rerender(callScreen());

    await waitFor(() => {
      expect(submitTurn).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(submitTurn).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        utterance: "Hola Mariana, hablo de KrakenLab.",
        clientTurnId: expect.any(String),
      }),
    );

    view.rerender(callScreen());
    expect(submitTurn).toHaveBeenCalledTimes(1);
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
});
