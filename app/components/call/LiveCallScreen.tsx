"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import type { PracticeMode } from "@/lib/db/types";
import { submitTurn } from "@/lib/api/client";
import type { RichTurnFeedback, TurnSummary } from "@/lib/api/client";
import { stubGetOpeningLine } from "@/lib/api/stubs";
import { newClientTurnId } from "@/lib/frontend/ids";
import { unlockClientPlayback } from "@/lib/voice/client-playback";
import { AnalyticsChips } from "@/app/components/call/AnalyticsChips";
import type { CallAnalytics } from "@/lib/scoring/types";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis";
import { useCallAudioDevices } from "@/lib/hooks/useCallAudioDevices";
import { useVoiceSession } from "@/lib/hooks/useVoiceSession";
import { useConvaiConnection } from "@/lib/hooks/useConvaiConnection";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getClientLine, ROUNDS } from "@/lib/simulation/rounds";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { AUTOSUBMIT_SILENCE_MS } from "@/lib/voice/timeouts";
import { isAutosubmitReady } from "@/lib/voice/autosubmit";

interface DialogueEntry {
  role: "client" | "you";
  text: string;
}

interface LiveCallScreenProps {
  callAttemptId: string;
  clientName: string;
  scenarioSlug: string;
  isPreset: boolean;
  client?: ClientPersona;
  mode: PracticeMode;
  level: number;
  totalRounds: number;
  verifiedUserId?: string;
  ending?: boolean;
  onHangUp: (turns: TurnSummary[]) => void;
}

const ROUND_LABELS = ["Apertura", "Objeción", "Claridad", "Correo", "Cierre"];

/** Time the round feedback stays on screen before the next round opens. */
const ROUND_ADVANCE_DELAY_MS = 1800;

export function LiveCallScreen({
  callAttemptId,
  clientName,
  scenarioSlug,
  isPreset,
  client,
  mode,
  level,
  totalRounds,
  verifiedUserId,
  ending = false,
  onHangUp,
}: LiveCallScreenProps) {
  const { showToast } = useToast();
  const voiceConfig = useVoiceConfig();
  const [convaiAudioActive, setConvaiAudioActive] = useState(false);
  const voiceSession = useVoiceSession(
    verifiedUserId ?? null,
    callAttemptId,
    mode,
    { meterConvaiSeconds: convaiAudioActive },
  );
  const sessionUsageId = voiceSession.sessionUsageId;
  const scenarioContext =
    isPreset && client
      ? `${client.company} · ${client.indicator} · problema: ${client.pains[0] ?? "operación"}`
      : `Escenario personalizado: ${scenarioSlug}`;

  const dialogueRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [convaiFailed, setConvaiFailed] = useState(false);
  const [round, setRound] = useState(1);
  const [roundLabel, setRoundLabel] = useState("Apertura");
  const [dialogue, setDialogue] = useState<DialogueEntry[]>([]);
  const [utterance, setUtterance] = useState("");
  const [turnEval, setTurnEval] = useState<{
    richFeedback: RichTurnFeedback;
    analytics: CallAnalytics;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const turnHistory = useRef<TurnSummary[]>([]);
  const submittingRef = useRef(false);
  const clientTurnIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<{ round: number; text: string } | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingSpokenRef = useRef(false);
  const [micArmed, setMicArmed] = useState(false);
  const utteranceRef = useRef("");

  const convai = useConvaiConnection({
    sessionUsageId,
    clientName,
    scenarioContext,
    enabled:
      mode === "voz" &&
      voiceConfig.convaiEnabled &&
      voiceSession.billedActive &&
      !voiceSession.fallbackToBrowser &&
      !convaiFailed,
    onAgentTranscript: (text) => {
      setDialogue((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "client" && last.text === text) return prev;
        return [...prev, { role: "client", text }];
      });
    },
    onUserTranscript: (text) => {
      setUtterance(text.trim());
    },
    onFallback: () => {
      setConvaiFailed(true);
    },
  });

  const {
    disconnect: disconnectConvai,
    interrupt: interruptConvai,
    connected: convaiConnected,
    failed: convaiConnectionFailed,
  } = convai;

  /** ConvAI only owns audio when connected; otherwise browser mic + TTS. */
  const clientVoiceIsConvai = mode === "voz" && convaiConnected;
  const useBrowserMic = mode === "voz" && !clientVoiceIsConvai;

  const synthesis = useSpeechSynthesis({
    sessionUsageId,
    locale: "es-MX",
  });
  const busy = submitting || hangingUp || ending;
  const holdMic = busy || synthesis.speaking;
  const callDevices = useCallAudioDevices(
    mode === "voz" && useBrowserMic && !hangingUp && !ending,
    voiceConfig.sttTier === "browser" || !voiceConfig.serverStt,
  );
  const speech = useSpeechRecognition({
    sessionUsageId,
    keepAlive: micArmed && mode === "voz",
    paused: holdMic,
    micDeviceId: callDevices.selectedMicId,
  });

  const roundMeta = isPreset ? ROUNDS[round - 1] : null;
  utteranceRef.current = utterance;

  useEffect(() => {
    setConvaiAudioActive(clientVoiceIsConvai);
  }, [clientVoiceIsConvai]);

  const convaiConnecting =
    mode === "voz" &&
    voiceConfig.convaiEnabled &&
    !convaiConnected &&
    !convaiFailed &&
    !convaiConnectionFailed &&
    !voiceSession.fallbackToBrowser;

  // Kept in a ref so speaking never re-runs the effects below when the voice
  // tier resolves and rebuilds the speak callback.
  const speakRef = useRef(synthesis.speak);
  useEffect(() => {
    speakRef.current = synthesis.speak;
  }, [synthesis.speak]);

  const openingLine = useMemo(
    () =>
      isPreset && client
        ? getClientLine(client, 0)
        : stubGetOpeningLine(scenarioSlug),
    [client, isPreset, scenarioSlug],
  );

  useEffect(() => {
    setDialogue([{ role: "client", text: openingLine }]);
    textareaRef.current?.focus();
  }, [openingLine]);

  // Wait for the billed voice session to resolve so the opening line is spoken
  // with the ElevenLabs voice when it is available, browser voice otherwise.
  const voiceOutputReady =
    voiceConfig.ready !== false &&
    (!voiceConfig.requiresVoiceAuth ||
      Boolean(sessionUsageId) ||
      voiceSession.fallbackToBrowser);

  useEffect(() => {
    if (mode !== "voz" || !voiceOutputReady || openingSpokenRef.current) return;
    if (convaiConnected) return;
    openingSpokenRef.current = true;
    speakRef.current(openingLine);
  }, [convaiConnected, mode, openingLine, voiceOutputReady]);

  useEffect(() => {
    return () => {
      disconnectConvai();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (autosubmitTimerRef.current) clearTimeout(autosubmitTimerRef.current);
    };
  }, [disconnectConvai]);

  const clearAutosubmitTimer = useCallback(() => {
    if (autosubmitTimerRef.current) {
      clearTimeout(autosubmitTimerRef.current);
      autosubmitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = dialogueRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [dialogue, turnEval]);

  const handleMic = () => {
    if (mode !== "voz" || !useBrowserMic || !speech.supported || hangingUp || ending)
      return;
    if (micArmed) {
      unlockClientPlayback();
      clearAutosubmitTimer();
      setMicArmed(false);
      speech.stopListening();
      return;
    }
    interruptConvai();
    // Cancel before unlocking: unlocking flushes any line that was waiting on a
    // user gesture, and cancelling afterwards would kill the line we just freed.
    synthesis.cancel();
    unlockClientPlayback();
    setMicArmed(true);
  };

  const handleSubmitTurn = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? utteranceRef.current).trim();
      if (!text || submittingRef.current || hangingUp || ending) return;

      clearAutosubmitTimer();

      const lastSent = lastSentRef.current;
      if (lastSent && lastSent.round === round && lastSent.text === text) return;

      submittingRef.current = true;
      setSubmitting(true);

      const clientTurnId = clientTurnIdRef.current ?? newClientTurnId();
      clientTurnIdRef.current = clientTurnId;

      try {
        const response = await submitTurn(callAttemptId, {
          utterance: text,
          clientTurnId,
        });

        clientTurnIdRef.current = null;
        lastSentRef.current = { round, text };

        const summary: TurnSummary = {
          roundKey: response.roundKey,
          roundLabel: response.roundLabel,
          roundType: response.roundType,
          utterance: response.traineeUtterance,
          expectedPhrase: response.richFeedback.strongerLine,
          roundScore: response.roundScore,
          richFeedback: response.richFeedback,
        };
        turnHistory.current.push(summary);

        setUtterance("");
        setDialogue((prev) => [...prev, { role: "you", text }]);
        setTurnEval({
          richFeedback: response.richFeedback,
          analytics: response.richFeedback.analytics ?? {
            talkPercent: 0,
            longestMonologueSeconds: 0,
            questionTypes: { open: 0, closed: 0, clarifying: 0 },
            patienceAfterBuyerTurnSeconds: null,
            hasNextStep: false,
          },
        });

        if (response.clientReply) {
          setDialogue((prev) => [
            ...prev,
            { role: "client", text: response.clientReply },
          ]);
          if (clientVoiceIsConvai) {
            interruptConvai();
          } else if (mode === "voz") {
            speakRef.current(response.clientReply);
          }
        }

        if (response.roundNumber < totalRounds) {
          if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
          advanceTimerRef.current = setTimeout(() => {
            setTurnEval(null);
            setRound(response.roundNumber + 1);
            setRoundLabel(response.roundLabel);
            textareaRef.current?.focus();
          }, ROUND_ADVANCE_DELAY_MS);
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No se pudo enviar el turno.";
        showToast(message, "error");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [
      callAttemptId,
      clientVoiceIsConvai,
      ending,
      hangingUp,
      interruptConvai,
      mode,
      round,
      showToast,
      totalRounds,
      clearAutosubmitTimer,
    ],
  );

  const resetTranscriptRef = useRef(speech.resetTranscript);
  resetTranscriptRef.current = speech.resetTranscript;
  const ensureListeningRef = useRef(speech.ensureListening);
  ensureListeningRef.current = speech.ensureListening;
  const stopListeningRef = useRef(speech.stopListening);
  stopListeningRef.current = speech.stopListening;
  const releaseCallMicRef = useRef(callDevices.releaseMic);
  releaseCallMicRef.current = callDevices.releaseMic;
  const synthesisSpeakingRef = useRef(synthesis.speaking);
  synthesisSpeakingRef.current = synthesis.speaking;
  const endingRef = useRef(ending);
  endingRef.current = ending;
  const hangingUpRef = useRef(hangingUp);
  hangingUpRef.current = hangingUp;
  const handleSubmitTurnRef = useRef(handleSubmitTurn);
  handleSubmitTurnRef.current = handleSubmitTurn;

  const releaseCallAudio = useCallback(() => {
    clearAutosubmitTimer();
    setMicArmed(false);
    stopListeningRef.current();
    releaseCallMicRef.current();
    synthesis.cancel();
    disconnectConvai();
  }, [clearAutosubmitTimer, disconnectConvai, synthesis]);

  const releaseCallAudioRef = useRef(releaseCallAudio);
  releaseCallAudioRef.current = releaseCallAudio;

  useEffect(() => {
    if (!hangingUp && !ending) return;
    releaseCallAudio();
  }, [ending, hangingUp, releaseCallAudio]);

  useEffect(() => {
    return () => {
      releaseCallAudioRef.current();
    };
  }, []);

  useEffect(() => {
    if (!speech.transcript || speech.listening) return;
    const piece = speech.transcript.trim();
    resetTranscriptRef.current();
    if (!piece) return;
    const next = utteranceRef.current
      ? `${utteranceRef.current} ${piece}`
      : piece;
    utteranceRef.current = next;
    setUtterance(next);
  }, [speech.listening, speech.transcript]);

  useEffect(() => {
    if (!micArmed || mode !== "voz" || busy || synthesis.speaking || speech.listening) {
      return;
    }
    const pending = utterance.trim();
    if (!pending || !isAutosubmitReady(pending)) return;

    clearAutosubmitTimer();
    autosubmitTimerRef.current = setTimeout(() => {
      autosubmitTimerRef.current = null;
      const text = utteranceRef.current.trim();
      if (
        !text ||
        !isAutosubmitReady(text) ||
        submittingRef.current ||
        hangingUpRef.current ||
        endingRef.current ||
        synthesisSpeakingRef.current
      ) {
        return;
      }
      void handleSubmitTurnRef.current(text);
    }, AUTOSUBMIT_SILENCE_MS);

    return () => {
      clearAutosubmitTimer();
    };
  }, [
    busy,
    clearAutosubmitTimer,
    micArmed,
    mode,
    speech.listening,
    synthesis.speaking,
    utterance,
  ]);

  useEffect(() => {
    if (holdMic) clearAutosubmitTimer();
  }, [clearAutosubmitTimer, holdMic]);

  useEffect(() => {
    if (!micArmed || mode !== "voz" || holdMic) return;
    ensureListeningRef.current();
  }, [holdMic, micArmed, mode, synthesis.speaking]);

  const handleHangUp = () => {
    if (busy) return;
    releaseCallAudio();
    setHangingUp(true);
    onHangUp([...turnHistory.current]);
  };

  const displayRoundLabel = roundMeta?.label ?? roundLabel;
  const progressPct = Math.round(((round - 1) / totalRounds) * 100);
  const billedTtsActive =
    Boolean(sessionUsageId) &&
    voiceConfig.serverTts &&
    !voiceSession.fallbackToBrowser;
  const showBrowserVoiceNote =
    !convaiConnected &&
    !billedTtsActive &&
    (voiceSession.fallbackToBrowser ||
      convaiFailed ||
      convaiConnectionFailed ||
      voiceConfig.ttsTier === "browser");

  return (
    <section className="call-screen" aria-label="Llamada en vivo">
      <header className="call-screen__header">
        <div>
          <p className="call-screen__status">
            <span className="call-screen__live-dot" aria-hidden="true" />
            En llamada
          </p>
          <h1 className="call-screen__client">{clientName}</h1>
          <p className="call-screen__meta">
            Nivel {level} · Modo {mode}
          </p>
        </div>
        <Button variant="danger" onClick={handleHangUp} loading={hangingUp || ending}>
          Colgar
        </Button>
      </header>

      <div
        className="round-progress"
        role="progressbar"
        aria-valuenow={round}
        aria-valuemin={1}
        aria-valuemax={totalRounds}
        aria-label={`Ronda ${round} de ${totalRounds}`}
      >
        <div className="round-progress__track">
          <div
            className="round-progress__fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <ol className="round-progress__steps">
          {ROUND_LABELS.slice(0, totalRounds).map((label, i) => {
            const stepNum = i + 1;
            const state =
              stepNum < round
                ? "done"
                : stepNum === round
                  ? "current"
                  : "pending";
            return (
              <li
                key={label}
                className={`round-progress__step round-progress__step--${state}`}
              >
                <span className="round-progress__dot" aria-hidden="true" />
                <span className="round-progress__label">{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="round-progress__current">
          Ronda {round}/{totalRounds} · {displayRoundLabel}
        </p>
      </div>

      <div className="call-screen__panel">
        <div className="dialogue" ref={dialogueRef} aria-live="polite">
          {dialogue.map((entry, i) => (
            <div
              key={`${entry.role}-${i}`}
              className={`dialogue__bubble dialogue__bubble--${entry.role}`}
            >
              <span className="dialogue__speaker">
                {entry.role === "client" ? "Cliente" : "Tú"}
              </span>
              <p>{entry.text}</p>
            </div>
          ))}
        </div>

        <div className="call-screen__composer">
          {useBrowserMic && callDevices.ready ? (
            <div className="call-devices" aria-label="Dispositivos de audio">
              <label className="call-devices__field">
                <span className="call-devices__label">Micrófono</span>
                <select
                  className="call-devices__select"
                  value={callDevices.selectedMicId}
                  onChange={(event) => {
                    void callDevices.selectMic(event.target.value);
                  }}
                  disabled={hangingUp || ending}
                >
                  {callDevices.inputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>
              {callDevices.speakerSupported ? (
                <label className="call-devices__field">
                  <span className="call-devices__label">Altavoz</span>
                  <select
                    className="call-devices__select"
                    value={callDevices.selectedSpeakerId}
                    onChange={(event) => {
                      void callDevices.selectSpeaker(event.target.value);
                    }}
                    disabled={hangingUp || ending}
                  >
                    {callDevices.outputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {callDevices.micCaptureNote ? (
            <p className="call-screen__note call-devices__note">
              {callDevices.micCaptureNote}
            </p>
          ) : null}

          <textarea
            ref={textareaRef}
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            placeholder={
              mode === "voz"
                ? "Responde aquí o usa el micrófono…"
                : "Escribe tu respuesta…"
            }
            aria-label="Tu respuesta"
            disabled={busy}
          />

          <div className="call-screen__actions">
            {useBrowserMic ? (
              <Button
                variant="secondary"
                onClick={handleMic}
                disabled={!speech.supported || hangingUp || ending}
              >
                {micArmed && speech.listening
                  ? "Escuchando…"
                  : micArmed
                    ? "Reanudando micrófono…"
                    : "Micrófono"}
              </Button>
            ) : clientVoiceIsConvai ? (
              <span className="call-screen__note">Micrófono activo en la llamada</span>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void handleSubmitTurn()}
              disabled={!utterance.trim() || busy}
              loading={submitting}
            >
              Enviar turno
            </Button>
          </div>
        </div>

        {voiceSession.warnLowTime ? (
          <p className="call-screen__note call-screen__note--warn">
            Queda poco tiempo de voz en esta sesión.
          </p>
        ) : null}
        {convaiConnecting ? (
          <p className="call-screen__note">
            Agente de voz no conectado: usa el micrófono y escucha al cliente
            por el navegador.
          </p>
        ) : null}
        {showBrowserVoiceNote ? (
          <p className="call-screen__note">
            Usando voz del navegador (sin facturación ElevenLabs).
          </p>
        ) : null}
        {convaiConnected ? (
          <p className="call-screen__note">Agente de voz conectado.</p>
        ) : null}
        {speech.error ? (
          <p className="call-screen__note call-screen__note--warn">{speech.error}</p>
        ) : null}

        {turnEval ? (
          <div className="coaching-card" role="status">
            <p className="coaching-card__why">{turnEval.richFeedback.whyScore}</p>
            <AnalyticsChips analytics={turnEval.analytics} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
