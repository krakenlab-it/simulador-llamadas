import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ToastProvider } from "@/components/ui/Toast";

const speak = vi.fn();

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
    cancel: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useVoiceSession", () => ({
  useVoiceSession: () => ({
    sessionUsageId: null,
    verifiedUserId: "preview-user",
    billedActive: false,
    remainingConvaiSeconds: 180,
    warnLowTime: false,
    fallbackToBrowser: false,
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
    elevenlabsBilledAvailable: true,
    pronunciationDictionary: true,
    ready: true,
    brakes: {},
  }),
}));

describe("live call billed TTS without a usage session", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not show the browser-voice banner when ElevenLabs is available", async () => {
    render(
      <ToastProvider>
        <LiveCallScreen
          callAttemptId="call-1"
          clientName="Claudia Soto"
          scenarioSlug="claudia-soto"
          isPreset={false}
          mode="voz"
          level={2}
          totalRounds={5}
          verifiedUserId="preview-user"
          onHangUp={vi.fn()}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(speak).toHaveBeenCalled();
    });
    expect(
      screen.queryByText(/sin facturación ElevenLabs/i),
    ).not.toBeInTheDocument();
  });
});
