"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import type { PracticeMode } from "@/lib/db/types";
import { submitTurn } from "@/lib/api/client";
import type { TurnSummary } from "@/lib/api/client";
import { getKeywordLabels } from "@/lib/simulation/keywords";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis";
import { getClientLine, ROUNDS } from "@/lib/simulation/rounds";

interface DialogueEntry {
  role: "client" | "you";
  text: string;
}

interface TurnEval {
  roundScore: number;
  expectedPhrase: string;
  keywordHits: Record<string, boolean>;
}

interface LiveCallScreenProps {
  callAttemptId: string;
  client: ClientPersona;
  mode: PracticeMode;
  level: number;
  onHangUp: (turns: TurnSummary[]) => void;
}

export function LiveCallScreen({
  callAttemptId,
  client,
  mode,
  level,
  onHangUp,
}: LiveCallScreenProps) {
  const [round, setRound] = useState(1);
  const [dialogue, setDialogue] = useState<DialogueEntry[]>([]);
  const [utterance, setUtterance] = useState("");
  const [turnEval, setTurnEval] = useState<TurnEval | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const turnHistory = useRef<TurnSummary[]>([]);
  const speech = useSpeechRecognition();
  const synthesis = useSpeechSynthesis();
  const dialogueRef = useRef<HTMLDivElement>(null);

  const roundMeta = ROUNDS[round - 1];

  useEffect(() => {
    const opening = getClientLine(client, 0);
    setDialogue([{ role: "client", text: opening }]);
    if (mode === "voz") {
      synthesis.speak(opening);
    }
  }, [client, mode, synthesis]);

  useEffect(() => {
    dialogueRef.current?.scrollTo({
      top: dialogueRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [dialogue, turnEval]);

  const handleMic = () => {
    if (mode !== "voz" || !speech.supported) {
      return;
    }
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
    if (!text || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitTurn(callAttemptId, { utterance: text });

      const summary: TurnSummary = {
        roundType: response.roundType,
        utterance: response.traineeUtterance,
        expectedPhrase: response.feedback,
        roundScore: response.roundScore,
      };
      turnHistory.current.push(summary);

      setDialogue((prev) => [...prev, { role: "you", text }]);
      setTurnEval({
        roundScore: response.roundScore,
        expectedPhrase: response.feedback,
        keywordHits: response.keywordHits as Record<string, boolean>,
      });

      if (response.roundNumber < 5) {
        setTimeout(() => {
          setUtterance("");
          setTurnEval(null);
          setRound(response.roundNumber + 1);
          if (response.clientReply) {
            setDialogue((prev) => [
              ...prev,
              { role: "client", text: response.clientReply },
            ]);
            if (mode === "voz") {
              synthesis.speak(response.clientReply);
            }
          }
        }, 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const keywordLabels = getKeywordLabels();

  return (
    <section className="screen active" aria-label="Llamada en vivo">
      <div className="call-panel">
        <div className="round-label">
          {roundMeta
            ? `Ronda ${round} · ${roundMeta.label}`
            : `Ronda ${round}`}
        </div>
        <div className="client-line">
          {client.name} · Nivel {level} · Modo {mode}
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
              {speech.listening ? "🎤 Escuchando…" : "🎤 Escuchar"}
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

        {turnEval && (
          <div
            className={`eval ${turnEval.roundScore >= 50 ? "good" : "bad"}`}
          >
            <strong>Puntuación ronda: {turnEval.roundScore}/100</strong>
            <p>
              Debería haber dicho algo como:{" "}
              <em>{turnEval.expectedPhrase}</em>
            </p>
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
          </div>
        )}
      </div>
    </section>
  );
}
