import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";

import { submitTurn } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  submitTurn: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    ttsTier: "browser",
    traces: [],
    speak: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceSession", () => ({
  useVoiceSession: () => ({
    sessionUsageId: null,
    verifiedUserId: null,
    billedActive: false,
    remainingConvaiSeconds: 180,
    warnLowTime: false,
    fallbackToBrowser: true,
    resolved: true,
  }),
}));

vi.mock("@/lib/hooks/useConvaiConnection", () => ({
  useConvaiConnection: () => ({
    connected: false,
    agentSpeaking: false,
    failed: false,
    disconnect: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

const speechState = vi.hoisted(() => ({
  supported: true,
  listening: false,
  transcript: "",
  error: null as string | null,
  startListening: vi.fn(),
  stopListening: vi.fn(),
  resetTranscript: vi.fn(),
  ensureListening: vi.fn(),
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

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    sttTier: "browser",
    ttsTier: "browser",
    convaiEnabled: false,
    serverTts: false,
    serverStt: false,
    requiresVoiceAuth: false,
    ready: true,
  }),
}));

function renderCall(mode: "voz" | "texto") {
  return render(
    <ToastProvider>
      <LiveCallScreen
        callAttemptId="call-1"
        clientName="Javier Velasco"
        scenarioSlug="javier-velasco"
        isPreset={false}
        mode={mode}
        level={2}
        totalRounds={5}
        onHangUp={vi.fn()}
      />
    </ToastProvider>,
  );
}

describe("LiveCallScreen practice mode UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    speechState.supported = true;
    speechState.listening = false;
    speechState.error = null;
  });

  it("shows the Micrófono button when mode is voz", () => {
    renderCall("voz");
    expect(screen.getByRole("button", { name: "Micrófono" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Responde aquí o usa el micrófono…"),
    ).toBeInTheDocument();
  });

  it("shows a text-only note and no mic button when mode is texto", () => {
    renderCall("texto");
    expect(screen.queryByRole("button", { name: "Micrófono" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Esta práctica está en modo solo texto/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu respuesta…")).toBeInTheDocument();
  });

  it("can switch to voice locally from a text-only call", async () => {
    const user = userEvent.setup();
    renderCall("texto");

    await user.click(
      screen.getByRole("button", { name: "Usar micrófono en esta llamada" }),
    );

    expect(screen.getByRole("button", { name: "Micrófono" })).toBeInTheDocument();
    expect(
      screen.queryByText(/Esta práctica está en modo solo texto/i),
    ).not.toBeInTheDocument();
  });

  it("submits turns with voice mode after enabling the mic mid-call", async () => {
    const user = userEvent.setup();
    vi.mocked(submitTurn).mockResolvedValue({
      turnId: "turn-1",
      roundNumber: 1,
      roundType: "apertura",
      roundKey: "apertura-1",
      roundLabel: "Apertura",
      traineeUtterance: "Hola",
      roundScore: 80,
      keywordHits: {},
      clientReaction: "medio",
      clientReply: "¿Sí?",
      feedback: "ok",
      richFeedback: {
        score: 80,
        utterance: "Hola",
        whyScore: "",
        strongerLine: "",
        missedCriteria: [],
        roundLabel: "Apertura",
      },
      hasConcreteDayAndTime: false,
      won: false,
    });

    renderCall("texto");
    await user.click(
      screen.getByRole("button", { name: "Usar micrófono en esta llamada" }),
    );

    const textarea = screen.getByLabelText("Tu respuesta");
    await user.type(textarea, "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    expect(submitTurn).toHaveBeenCalledWith("call-1", {
      utterance: "Hola",
      clientTurnId: expect.any(String),
      mode: "voz",
    });
  });
});
