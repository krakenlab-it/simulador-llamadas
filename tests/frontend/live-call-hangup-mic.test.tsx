import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";

const speak = vi.fn();
const cancel = vi.fn();
const releaseMic = vi.fn();
const stopListening = vi.fn();

vi.mock("@/lib/api/client", () => ({
  submitTurn: vi.fn(),
  saveScenarioVoiceAgent: vi.fn(),
}));

import { submitTurn } from "@/lib/api/client";
import type { TurnResponse } from "@/lib/api/stubs";

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
    sttTier: "browser",
    startListening: vi.fn(),
    stopListening,
    resetTranscript: vi.fn(),
    ensureListening: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useCallAudioDevices", () => ({
  useCallAudioDevices: () => ({
    ready: true,
    speakerSupported: false,
    inputs: [{ deviceId: "mic-1", label: "Mic 1" }],
    outputs: [],
    selectedMicId: "mic-1",
    selectedSpeakerId: "",
    micCaptureNote: null,
    refreshDevices: vi.fn(),
    selectMic: vi.fn(),
    selectSpeaker: vi.fn(),
    releaseMic,
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
    elevenlabsBilledAvailable: true,
    pronunciationDictionary: true,
    brakes: {},
    ready: true,
  }),
}));

function renderCall(onHangUp = vi.fn()) {
  return render(
    <ToastProvider>
      <LiveCallScreen
        callAttemptId="call-1"
        clientName="Mariana Escobedo"
        scenarioSlug="mariana"
        isPreset={false}
        mode="voz"
        level={2}
        totalRounds={5}
        onHangUp={onHangUp}
      />
    </ToastProvider>,
  );
}

describe("live call hang-up mic release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("releases speech capture and device mic before navigating away", async () => {
    const onHangUp = vi.fn();
    const user = userEvent.setup();
    renderCall(onHangUp);

    await user.click(screen.getByRole("button", { name: "Colgar" }));

    await waitFor(() => {
      expect(stopListening).toHaveBeenCalled();
      expect(releaseMic).toHaveBeenCalled();
      expect(cancel).toHaveBeenCalled();
      expect(onHangUp).toHaveBeenCalledTimes(1);
    });

    const hangUpOrder = onHangUp.mock.invocationCallOrder[0];
    expect(stopListening.mock.invocationCallOrder[0]).toBeLessThan(hangUpOrder);
    expect(releaseMic.mock.invocationCallOrder[0]).toBeLessThan(hangUpOrder);
  });

  it("lets Colgar end the call while a turn is still scoring", async () => {
    let resolveTurn: (value: TurnResponse) => void = () => undefined;
    vi.mocked(submitTurn).mockImplementation(
      () =>
        new Promise<TurnResponse>((resolve) => {
          resolveTurn = resolve;
        }),
    );
    const onHangUp = vi.fn();
    const user = userEvent.setup();
    renderCall(onHangUp);

    await user.type(screen.getByLabelText("Tu respuesta"), "Hola Mariana");
    await user.click(screen.getByRole("button", { name: "Enviar turno" }));

    await waitFor(() => {
      expect(submitTurn).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Colgar" }));

    await waitFor(() => {
      expect(onHangUp).toHaveBeenCalledTimes(1);
    });
    resolveTurn({
      turnId: "turn-1",
      roundNumber: 1,
      roundType: "apertura",
      roundKey: "apertura",
      roundLabel: "Apertura",
      traineeUtterance: "Hola Mariana",
      roundScore: 70,
      keywordHits: {},
      clientReaction: "bien",
      clientReply: "Cuéntame más.",
      feedback: "ok",
      richFeedback: {
        score: 70,
        utterance: "Hola Mariana",
        whyScore: "ok",
        strongerLine: "ok",
        missedCriteria: [],
        roundLabel: "Apertura",
      },
      hasConcreteDayAndTime: false,
      won: false,
    });
  });
});
