"use client";

import { useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import { CLIENTS } from "@/lib/clients";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { fetchHistory } from "@/lib/api/client";
import type { HistoryEntry } from "@/lib/api/client";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";

export interface SetupConfig {
  client: ClientPersona;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
}

interface SetupScreenProps {
  onStart: (config: SetupConfig) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<PracticeMode>("voz");
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [micTested, setMicTested] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const speech = useSpeechRecognition();

  const selectedClient = CLIENTS.find((c) => c.slug === selectedSlug) ?? null;

  const handleMicTest = () => {
    if (mode !== "voz") {
      return;
    }
    if (!speech.supported) {
      return;
    }
    speech.startListening();
    setMicTested(true);
  };

  const canCall =
    selectedClient !== null &&
    (mode === "texto" || (speech.supported && micTested));

  const handleMarcar = () => {
    if (!selectedClient || !canCall) {
      return;
    }
    onStart({
      client: selectedClient,
      mode,
      difficultyLevel: level,
    });
  };

  const handleToggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const entries = await fetchHistory();
      setHistory(entries);
      setShowHistory(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <section className="screen active" aria-label="Configuración de la práctica">
      <h2>Configura la práctica</h2>
      <p className="subtitle">
        Elige cliente, modo y nivel. En modo voz, prueba el micrófono antes de
        marcar.
      </p>

      <h3 className="section-label">Elige tu cliente</h3>
      <div className="grid cols-3">
        {CLIENTS.map((client) => (
          <article
            key={client.slug}
            className={`card selectable ${selectedSlug === client.slug ? "selected" : ""}`}
            onClick={() => setSelectedSlug(client.slug)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectedSlug(client.slug);
              }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedSlug === client.slug}
          >
            <h3>{client.name}</h3>
            <div className="role">
              {client.title} · {client.company}
            </div>
            <span className={`badge ${client.badge}`}>{client.difficulty}</span>
            <p className="indicator">Indicador: {client.indicator}</p>
            <ul className="pains">
              {client.pains.map((pain) => (
                <li key={pain}>{pain}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="section-label">
        <strong>Modo</strong>
      </p>
      <div className="toggle-group" role="group" aria-label="Modo de práctica">
        <button
          type="button"
          className={mode === "voz" ? "active" : ""}
          onClick={() => {
            setMode("voz");
            setMicTested(false);
          }}
        >
          Voz
        </button>
        <button
          type="button"
          className={mode === "texto" ? "active" : ""}
          onClick={() => setMode("texto")}
        >
          Texto
        </button>
      </div>

      <p className="section-label">
        <strong>Nivel de dificultad</strong>
      </p>
      <div className="toggle-group" role="group" aria-label="Nivel de dificultad">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={level === n ? "active" : ""}
            onClick={() => setLevel(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {mode === "voz" && (
        <div className="mic-test">
          <p className="section-label">
            <strong>Prueba de micrófono</strong>
          </p>
          {!speech.supported ? (
            <p className="note warn">
              Web Speech API no disponible. Usa modo texto o Chrome/Edge.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleMicTest}
                disabled={speech.listening}
              >
                {speech.listening ? "🎤 Escuchando…" : "🎤 Probar micrófono"}
              </button>
              {speech.transcript && (
                <p className="mic-result">
                  Escuché: &ldquo;{speech.transcript}&rdquo;
                </p>
              )}
              {speech.error && <p className="note warn">{speech.error}</p>}
              {micTested && !speech.error && (
                <p className="note success">Micrófono listo.</p>
              )}
            </>
          )}
        </div>
      )}

      <div className="controls">
        <button
          type="button"
          className="primary"
          disabled={!canCall}
          onClick={handleMarcar}
        >
          Marcar
        </button>
        <button
          type="button"
          onClick={() => void handleToggleHistory()}
          disabled={historyLoading}
        >
          {historyLoading
            ? "Cargando…"
            : showHistory
              ? "Ocultar historial"
              : "Ver historial"}
        </button>
      </div>

      {showHistory && (
        <div className="history-panel">
          <h3 className="section-label">Historial</h3>
          {history.length === 0 ? (
            <p className="subtitle">Sin llamadas guardadas.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.callAttemptId} className="history-item">
                {new Date(entry.startedAt).toLocaleString("es-MX")} ·{" "}
                {entry.clientName} · Nivel {entry.difficultyLevel} ·{" "}
                {entry.mode} · {entry.totalScore ?? 0} pts ·{" "}
                {entry.won ? "Ganó" : "No ganó"}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
