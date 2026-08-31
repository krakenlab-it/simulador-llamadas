"use client";

import { useEffect, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import { CLIENTS } from "@/lib/clients";
import { listScenarios } from "@/lib/api/client";
import { loadLocalHistory, type LocalHistoryEntry } from "@/lib/history/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";

export interface SetupConfig {
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  totalRounds: number;
  /** @deprecated use scenarioSlug — kept for clinic preset compatibility */
  client?: ClientPersona;
}

interface SetupScreenProps {
  onStart: (config: SetupConfig) => void;
  onCreateScenario: () => void;
  refreshKey?: number;
}

export function SetupScreen({
  onStart,
  onCreateScenario,
  refreshKey = 0,
}: SetupScreenProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [mode, setMode] = useState<PracticeMode>("voz");
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [micTested, setMicTested] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);
  const speech = useSpeechRecognition();

  useEffect(() => {
    void listScenarios().then(setScenarios);
  }, [refreshKey]);

  const presets = scenarios.filter((s) => s.isPreset);
  const custom = scenarios.filter((s) => !s.isPreset);
  const displayPresets =
    presets.length > 0
      ? presets
      : CLIENTS.map(
          (c) =>
            ({
              slug: c.slug,
              clientName: c.name,
              clientTitle: c.title,
              companyContext: c.company,
              difficultyLabel: c.difficulty,
              indicator: c.indicator,
              painPoints: c.pains,
              isPreset: true,
              config: { rounds: [] },
            }) as unknown as ScenarioRecord,
        );

  const selected =
    scenarios.find((s) => s.slug === selectedSlug) ??
    displayPresets.find((s) => s.slug === selectedSlug) ??
    null;

  const selectedClient = CLIENTS.find((c) => c.slug === selectedSlug) ?? null;

  const handleMicTest = () => {
    if (mode !== "voz" || !speech.supported) return;
    speech.startListening();
    setMicTested(true);
  };

  const canCall =
    selected !== null && (mode === "texto" || (speech.supported && micTested));

  const handleMarcar = () => {
    if (!selected || !canCall) return;
    const totalRounds = selected.isPreset
      ? 5
      : (selected.config?.rounds?.length ?? 5);
    onStart({
      scenarioSlug: selected.slug,
      clientName: selected.clientName,
      isPreset: selected.isPreset,
      mode,
      difficultyLevel: level,
      totalRounds,
      client: selectedClient ?? undefined,
    });
  };

  const handleToggleHistory = () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setHistory(loadLocalHistory());
    setShowHistory(true);
  };

  const renderCard = (scenario: ScenarioRecord, isClinic: boolean) => (
    <article
      key={scenario.slug}
      className={`card selectable ${selectedSlug === scenario.slug ? "selected" : ""}`}
      onClick={() => setSelectedSlug(scenario.slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setSelectedSlug(scenario.slug);
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selectedSlug === scenario.slug}
    >
      <h3>{scenario.clientName}</h3>
      <div className="role">
        {scenario.clientTitle} · {scenario.companyContext}
      </div>
      {isClinic ? (
        <span
          className={`badge ${scenario.difficultyLabel === "Media" ? "medium" : "hard"}`}
        >
          {scenario.difficultyLabel}
        </span>
      ) : (
        <span className="badge custom">{scenario.industry ?? "Personalizado"}</span>
      )}
      <p className="indicator">
        {isClinic
          ? `Indicador: ${scenario.indicator}`
          : `Vende: ${scenario.productSold}`}
      </p>
      <ul className="pains">
        {(scenario.painPoints ?? []).slice(0, 3).map((pain) => (
          <li key={pain}>{pain}</li>
        ))}
      </ul>
    </article>
  );

  return (
    <section className="screen active" aria-label="Configuración de la práctica">
      <h2>Configura la práctica</h2>
      <p className="subtitle">
        Elige un escenario predefinido o crea el tuyo. En modo voz, prueba el
        micrófono antes de marcar.
      </p>

      <h3 className="section-label">Clínica de Citas (preset)</h3>
      <div className="grid cols-3">
        {displayPresets.map((s) => renderCard(s, true))}
      </div>

      {custom.length > 0 && (
        <>
          <h3 className="section-label">Mis escenarios</h3>
          <div className="grid cols-3">
            {custom.map((s) => renderCard(s, false))}
          </div>
        </>
      )}

      <div className="controls builder-cta">
        <button type="button" onClick={onCreateScenario}>
          + Crear escenario personalizado
        </button>
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
        <button type="button" onClick={handleToggleHistory}>
          {showHistory ? "Ocultar historial" : "Ver historial"}
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
                {entry.mode} · {entry.totalScore} pts ·{" "}
                {entry.won ? "Ganó" : "No ganó"}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
