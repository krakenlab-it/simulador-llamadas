"use client";

import { useEffect, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import { CLIENTS } from "@/lib/clients";
import { listScenarios } from "@/lib/api/client";
import {
  loadLocalHistorySafe,
  type LocalHistoryEntry,
} from "@/lib/history/local";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { VoiceAuthGate } from "@/app/components/VoiceAuthGate";
import { registerVerifiedVoiceUser } from "@/lib/auth/voice-session";
import { useAuth } from "@/lib/auth/context";
import { PendingButton } from "@/components/ui/PendingButton";
import { ScenarioCardSkeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";

export interface SetupConfig {
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  totalRounds: number;
  verifiedUserId?: string;
  verifiedEmail?: string;
  /** @deprecated use scenarioSlug — kept for clinic preset compatibility */
  client?: ClientPersona;
}

interface SetupScreenProps {
  onStart: (config: SetupConfig) => void;
  onCreateScenario: () => void;
  refreshKey?: number;
  /** After saving a custom scenario, pre-select it on setup (user still taps Marcar). */
  selectedSlugOnLoad?: string | null;
}

export function SetupScreen({
  onStart,
  onCreateScenario,
  refreshKey = 0,
  selectedSlugOnLoad = null,
}: SetupScreenProps) {
  const { showToast } = useToast();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [mode, setMode] = useState<PracticeMode>("voz");
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [micTested, setMicTested] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [voiceAuthSkipped, setVoiceAuthSkipped] = useState(false);
  const voiceConfig = useVoiceConfig();
  const { session } = useAuth();
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (!session?.user.email || verifiedUserId) return;

    let cancelled = false;
    void registerVerifiedVoiceUser().then((result) => {
      if (cancelled || !result) return;
      setVerifiedUserId(result.verifiedUserId);
      setVerifiedEmail(result.email);
    });

    return () => {
      cancelled = true;
    };
  }, [session, verifiedUserId]);

  useEffect(() => {
    let cancelled = false;
    setScenariosLoading(true);
    setScenariosError(null);

    void listScenarios()
      .then((data) => {
        if (!cancelled) setScenarios(data);
      })
      .catch(() => {
        if (!cancelled) {
          setScenariosError("No se pudieron cargar los escenarios.");
          showToast("No se pudieron cargar los escenarios.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setScenariosLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, showToast]);

  useEffect(() => {
    if (selectedSlugOnLoad) {
      setSelectedSlug(selectedSlugOnLoad);
    }
  }, [selectedSlugOnLoad, refreshKey]);

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
    if (speech.listening) {
      speech.stopListening();
      setMicTested(true);
      return;
    }
    speech.startListening();
  };

  const needsVoiceAuth =
    mode === "voz" &&
    voiceConfig.requiresVoiceAuth &&
    !voiceAuthSkipped &&
    !verifiedUserId;

  const canCall =
    selected !== null &&
    !scenariosLoading &&
    (mode === "texto" ||
      (speech.supported && micTested && (!needsVoiceAuth || verifiedUserId)));

  const handleMarcar = () => {
    if (!selected || !canCall) return;
    onStart({
      scenarioSlug: selected.slug,
      clientName: selected.clientName,
      isPreset: selected.isPreset,
      mode,
      difficultyLevel: level,
      totalRounds: 5,
      client: selectedClient ?? undefined,
      verifiedUserId: verifiedUserId ?? undefined,
      verifiedEmail: verifiedEmail ?? undefined,
    });
  };

  const handleToggleHistory = () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    window.setTimeout(() => {
      const result = loadLocalHistorySafe();
      setHistory(result.entries);
      setHistoryError(result.error);
      setHistoryLoading(false);
      setShowHistory(true);
    }, 120);
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

      <h3 className="section-label">Escenarios incluidos</h3>
      {scenariosError && (
        <p className="note warn" role="alert">
          {scenariosError}
        </p>
      )}
      <div className="grid cols-3" aria-busy={scenariosLoading || undefined}>
        {scenariosLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <ScenarioCardSkeleton key={`skeleton-${i}`} />
            ))
          : displayPresets.map((s) => renderCard(s, true))}
      </div>

      {!scenariosLoading && custom.length > 0 && (
        <>
          <h3 className="section-label">Mis escenarios</h3>
          <div className="grid cols-3">
            {custom.map((s) => renderCard(s, false))}
          </div>
        </>
      )}

      <div className="controls builder-cta">
        <button
          type="button"
          onClick={onCreateScenario}
          disabled={scenariosLoading}
        >
          + Crear escenario personalizado
        </button>
      </div>

      <div className="switch-row">
        <Switch
          id="practice-mode"
          label="Modo voz"
          checked={mode === "voz"}
          disabled={scenariosLoading}
          onChange={(checked) => {
            setMode(checked ? "voz" : "texto");
            if (checked) setMicTested(false);
          }}
        />
        <span className="switch-hint">
          {mode === "voz" ? "Practica hablando en el micrófono" : "Escribe cada turno"}
        </span>
      </div>

      <SegmentedSwitch
        id="difficulty-level"
        label="Nivel de dificultad"
        options={[
          { value: 1 as const, label: "1" },
          { value: 2 as const, label: "2" },
          { value: 3 as const, label: "3" },
        ]}
        value={level}
        disabled={scenariosLoading}
        onChange={setLevel}
      />

      {mode === "voz" && needsVoiceAuth && (
        <VoiceAuthGate
          onVerified={(id, email) => {
            setVerifiedUserId(id);
            setVerifiedEmail(email);
          }}
          onSkip={() => setVoiceAuthSkipped(true)}
        />
      )}

      {mode === "voz" && (
        <div className="mic-test">
          <p className="section-label">
            <strong>Prueba de micrófono</strong>
          </p>
          {!speech.supported ? (
            <p className="note warn">
              Reconocimiento de voz no disponible. Usa modo texto o Chrome/Edge.
            </p>
          ) : (
            <>
              <PendingButton
                pending={speech.listening}
                pendingLabel="🎤 Escuchando…"
                onClick={handleMicTest}
                disabled={scenariosLoading}
              >
                {speech.listening ? "🎤 Detener" : "🎤 Probar micrófono"}
              </PendingButton>
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
        <PendingButton
          variant="primary"
          disabled={!canCall}
          onClick={handleMarcar}
        >
          Marcar
        </PendingButton>
        <PendingButton
          pending={historyLoading}
          pendingLabel="Cargando historial…"
          onClick={handleToggleHistory}
          disabled={scenariosLoading}
        >
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </PendingButton>
      </div>

      {showHistory && (
        <div className="history-panel" aria-live="polite">
          <h3 className="section-label">Historial</h3>
          {historyLoading ? (
            <div className="history-panel-loading loading-inline" role="status">
              <Spinner size="sm" label="Cargando historial" />
              <span>Cargando historial…</span>
            </div>
          ) : historyError ? (
            <p className="history-panel-error" role="alert">
              {historyError}
            </p>
          ) : history.length === 0 ? (
            <p className="history-panel-empty subtitle">
              Sin llamadas guardadas en este dispositivo.
            </p>
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
