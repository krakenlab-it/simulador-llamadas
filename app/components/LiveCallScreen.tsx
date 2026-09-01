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
  onHangUp: (turns: TurnSummary[]) => void;
}

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
  onHangUp,
}: LiveCallScreenProps) {
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
  const turnHistory = useRef<TurnSummary[]>([]);

  const convai = useConvaiConnection({
    sessionUsageId,
    clientName,
    scenarioContext,
    enabled:
      mode === "voz" &&
      voiceConfig.convaiEnabled &&
      voiceSession.billedActive &&
      !voiceSession.fallbackToBrowser,
    onAgentTranscript: (text) => {
      setDialogue((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "client" && last.text === text) return prev;
        return [...prev, { role: "client", text }];
      });
    },
  });

  const { connect: connectConvai, disconnect: disconnectConvai, interrupt: interruptConvai, connected: convaiConnected } = convai;

  const speech = useSpeechRecognition({ sessionUsageId });
  const synthesis = useSpeechSynthesis({ sessionUsageId });

  const roundMeta = isPreset ? ROUNDS[round - 1] : null;

  useEffect(() => {
    const opening =
      isPreset && client
        ? getClientLine(client, 0)
        : stubGetOpeningLine(scenarioSlug);
    setDialogue([{ role: "client", text: opening }]);
    if (mode === "voz" && !voiceConfig.convaiEnabled) {
      synthesis.speak(opening);
    }
  }, [client, isPreset, mode, scenarioSlug, synthesis, voiceConfig.convaiEnabled]);

  useEffect(() => {
    if (
      mode !== "voz" ||
      !voiceConfig.convaiEnabled ||
      !voiceSession.billedActive ||
      voiceSession.fallbackToBrowser ||
      !sessionUsageId
    ) {
      return;
    }
    connectConvai();
    return () => disconnectConvai();
  }, [
    mode,
    voiceConfig.convaiEnabled,
    voiceSession.billedActive,
    voiceSession.fallbackToBrowser,
    sessionUsageId,
    connectConvai,
    disconnectConvai,
  ]);

  useEffect(() => {
    dialogueRef.current?.scrollTo({
      top: dialogueRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [dialogue, turnEval]);

  const handleMic = () => {
    if (mode !== "voz" || !speech.supported) return;
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
    if (!text || submitting) return;

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
        }, 1800);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const keywordLabels = getKeywordLabels();
  const displayRoundLabel = roundMeta?.label ?? roundLabel;

  return (
    <section className="screen active" aria-label="Llamada en vivo">
      <div className="call-panel">
        <div className="round-label">
          Ronda {round}/{totalRounds} · {displayRoundLabel}
        </div>
        <div className="client-line">
          {clientName} · Nivel {level} · Modo {mode}
        </div>

        <div className="dialogue" ref={dialogueRef} aria-live="polite">
          {dialogue.map((entry, i) => (
            <div key={`${entry.role}-${i}`} className={entry.role}>
              <strong>{entry.role === "client" ? "Cliente:" : "Tú:"}</strong>{" "}
              {entry.text}
            </div>
          ))}
        </div>

        <textarea
          value={utterance}
          onChange={(e) => setUtterance(e.target.value)}
          placeholder={
            mode === "voz"
              ? "Escribe tu respuesta o usa el micrófono…"
              : "Escribe tu respuesta…"
          }
          aria-label="Tu respuesta"
        />

        <div className="controls">
          {mode === "voz" && (
            <button
              type="button"
              onClick={handleMic}
              disabled={speech.listening || !speech.supported}
            >
              {speech.listening ? "🎤 Detener" : "🎤 Escuchar"}
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => void handleSubmitTurn()}
            disabled={!utterance.trim() || submitting}
          >
            Enviar turno
          </button>
          <button
            type="button"
            onClick={() => onHangUp([...turnHistory.current])}
          >
            Colgar y evaluar
          </button>
        </div>

        {speech.error && <p className="note warn">{speech.error}</p>}

        {voiceSession.warnLowTime && mode === "voz" && (
          <p className="note warn">
            Quedan {voiceSession.remainingConvaiSeconds}s de voz con IA en esta
            sesión.
          </p>
        )}

        {voiceSession.fallbackToBrowser && mode === "voz" && (
          <p className="note">
            Límite de voz con IA alcanzado; usando voz del navegador.
          </p>
        )}

        {convaiConnected && mode === "voz" && (
          <p className="note">ConvAI conectado · barge-in activo al usar el micrófono.</p>
        )}

        {turnEval && (
          <div
            className={`eval rich ${turnEval.roundScore >= 50 ? "good" : "bad"}`}
          >
            <strong>
              {turnEval.richFeedback.roundLabel}: {turnEval.roundScore}/100
            </strong>
            <p className="feedback-why">{turnEval.richFeedback.whyScore}</p>
            <p className="exact-phrase">
              Dijiste: &ldquo;{turnEval.richFeedback.utterance}&rdquo;
            </p>
            <p className="exact-phrase expected">
              Línea más fuerte:{" "}
              <em>{turnEval.richFeedback.strongerLine}</em>
            </p>
            {turnEval.richFeedback.missedCriteria.length > 0 && (
              <p className="missed-criteria">
                Criterios faltantes:{" "}
                {turnEval.richFeedback.missedCriteria.join(", ")}
              </p>
            )}
            {isPreset && (
              <div className="keywords">
                {keywordLabels.map(({ key, label }) => (
                  <span
                    key={key}
                    className={`kw ${turnEval.keywordHits[key] ? "hit" : ""}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
