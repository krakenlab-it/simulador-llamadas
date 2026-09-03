import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { submitTurn } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  submitTurn: vi.fn(),
}));

vi.mock("@/lib/hooks/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    ttsTier: "elevenlabs",
    speak: vi.fn(),
    cancel: vi.fn(),
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
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    transcript: "",
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
    ensureListening: vi.fn(),
  }),
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
    ttsTier: "elevenlabs",
    convaiEnabled: false,
    serverTts: true,
    serverStt: false,
    requiresVoiceAuth: true,
    ready: true,
  }),
}));

const CUSTOM_OPENING = "Buenas tardes, ¿llamo al gimnasio de Laura?";

function renderCustomCall() {
  return render(
    <ToastProvider>
      <LiveCallScreen
        callAttemptId="call-custom"
        clientName="Laura Méndez"
        scenarioSlug="laura-gimnasio"
        isPreset={false}
        mode="texto"
        level={2}
        totalRounds={5}
        phaseLabels={["Apertura", "Objeción", "Claridad", "Correo", "Cierre"]}
        openingLine={CUSTOM_OPENING}
        onHangUp={vi.fn()}
      />
    </ToastProvider>,
  );
}

describe("custom scenario live-call copy", () => {
  beforeEach(() => {
    vi.mocked(submitTurn).mockResolvedValue({
      turnId: "turn-1",
      roundNumber: 1,
      roundType: "apertura",
      roundKey: "apertura",
      roundLabel: "Apertura",
      traineeUtterance: "Hola Laura",
      roundScore: 70,
      keywordHits: {},
      clientReaction: "bien",
      clientReply: "Cuéntame de retención.",
      feedback: "ok",
      richFeedback: {
        score: 70,
        utterance: "Hola Laura",
        whyScore: "ok",
        strongerLine: "ok",
        missedCriteria: [],
        roundLabel: "Apertura",
      },
      hasConcreteDayAndTime: false,
      won: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("uses the authored opening line instead of the generic stub", async () => {
    renderCustomCall();
    expect(await screen.findByText(CUSTOM_OPENING)).toBeInTheDocument();
  });

  it("advances the progress label to the next authored phase", async () => {
    renderCustomCall();

    fireEvent.change(screen.getByLabelText("Tu respuesta"), {
      target: { value: "Hola Laura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(
      () => {
        expect(screen.getByText("Ronda 2/5 · Objeción")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
