"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import type { PracticeMode } from "@/lib/db/types";
import { submitTurn } from "@/lib/api/client";
import type { RichTurnFeedback, TurnSummary } from "@/lib/api/client";
import { stubGetOpeningLine } from "@/lib/api/stubs";
import { getKeywordLabels } from "@/lib/simulation/keywords";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis";
import { useVoiceSession } from "@/lib/hooks/useVoiceSession";
import { useConvaiConnection } from "@/lib/hooks/useConvaiConnection";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getClientLine, ROUNDS } from "@/lib/simulation/rounds";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";

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
  const voiceSession = useVoiceSession(
    verifiedUserId ?? null,
    callAttemptId,
    mode,
  );
  const sessionUsageId = voiceSession.sessionUsageId;
  const scenarioContext =
    isPreset && client
      ? `${client.company} · ${client.indicator}`
      : `Escenario ${scenarioSlug}`;

  const dialogueRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [convaiFailed, setConvaiFailed] = useState(false);
  const [round, setRound] = useState(1);
  const [roundLabel, setRoundLabel] = useState("Apertura");
  const [dialogue, setDialogue] = useState<DialogueEntry[]>([]);
  const [utterance, setUtterance] = useState("");
  const [turnEval, setTurnEval] = useState<{
    roundScore: number;
    richFeedback: RichTurnFeedback;
    keywordHits: Record<string, boolean>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const turnHistory = useRef<TurnSummary[]>([]);

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

  const speech = useSpeechRecognition({ sessionUsageId });
  const synthesis = useSpeechSynthesis({ sessionUsageId });

  const roundMeta = isPreset ? ROUNDS[round - 1] : null;
  const busy = submitting || hangingUp || ending;

  useEffect(() => {
    const opening =
      isPreset && client
        ? getClientLine(client, 0)
        : stubGetOpeningLine(scenarioSlug);
    setDialogue([{ role: "client", text: opening }]);
    if (mode === "voz" && !voiceConfig.convaiEnabled) {
      synthesis.speak(opening);
    }
    textareaRef.current?.focus();
  }, [client, isPreset, mode, scenarioSlug, synthesis, voiceConfig.convaiEnabled]);

  useEffect(() => {
    return () => disconnectConvai();
  }, [disconnectConvai]);

  useEffect(() => {
    const el = dialogueRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [dialogue, turnEval]);

  const useBrowserMic =
    mode === "voz" &&
    (!voiceConfig.convaiEnabled ||
      convaiFailed ||
      convaiConnectionFailed ||
      voiceSession.fallbackToBrowser);

  const handleMic = () => {
    if (mode !== "voz" || !useBrowserMic || !speech.supported || busy) return;
    if (speech.listening) {
      speech.stopListening();
      return;
    }
    interruptConvai();
    synthesis.cancel();
    speech.startListening();
  };

  useEffect(() => {
    if (speech.transcript && !speech.listening) {
      setUtterance((prev) =>
        prev ? `${prev} ${speech.transcript}` : speech.transcript,
      );
      speech.resetTranscript();
    }
  }, [speech.listening, speech.transcript, speech]);

  const handleSubmitTurn = async () => {
    const text = utterance.trim();
    if (!text || submitting || busy) return;

    setSubmitting(true);
    try {
      const response = await submitTurn(callAttemptId, { utterance: text });

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

      setDialogue((prev) => [...prev, { role: "you", text }]);
      setTurnEval({
        roundScore: response.roundScore,
        richFeedback: response.richFeedback,
        keywordHits: response.keywordHits,
      });

      if (response.roundNumber < totalRounds) {
        setTimeout(() => {
          setUtterance("");
          setTurnEval(null);
          setRound(response.roundNumber + 1);
          setRoundLabel(response.roundLabel);
          if (response.clientReply) {
            setDialogue((prev) => [
              ...prev,
              { role: "client", text: response.clientReply },
            ]);
            if (mode === "voz") {
              if (convaiConnected) {
                interruptConvai();
              } else {
                synthesis.speak(response.clientReply);
              }
            }
          }
          textareaRef.current?.focus();
        }, 1800);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo enviar el turno.";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHangUp = () => {
    if (busy) return;
    setHangingUp(true);
    onHangUp([...turnHistory.current]);
  };

  const keywordLabels = getKeywordLabels();
  const displayRoundLabel = roundMeta?.label ?? roundLabel;
  const progressPct = Math.round(((round - 1) / totalRounds) * 100);

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
                disabled={!speech.supported || busy}
              >
                {speech.listening ? "Escuchando…" : "Micrófono"}
              </Button>
            ) : convaiConnected ? (
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
        {voiceSession.fallbackToBrowser || convaiFailed || convaiConnectionFailed ? (
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
          <div
            className={`coaching-card ${turnEval.roundScore >= 50 ? "coaching-card--good" : "coaching-card--low"}`}
            role="status"
          >
            <p className="coaching-card__score">
              {turnEval.richFeedback.roundLabel}: {turnEval.roundScore}/100
            </p>
            <p className="coaching-card__why">{turnEval.richFeedback.whyScore}</p>
            <p className="coaching-card__line">
              Línea más fuerte:{" "}
              <em>{turnEval.richFeedback.strongerLine}</em>
            </p>
            {turnEval.richFeedback.missedCriteria.length > 0 ? (
              <p className="coaching-card__missed">
                Criterios faltantes:{" "}
                {turnEval.richFeedback.missedCriteria.join(", ")}
              </p>
            ) : null}
            {isPreset ? (
              <div className="keyword-tags">
                {keywordLabels.map(({ key, label }) => (
                  <span
                    key={key}
                    className={`keyword-tags__item ${turnEval.keywordHits[key] ? "keyword-tags__item--hit" : ""}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
