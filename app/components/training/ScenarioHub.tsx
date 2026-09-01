"use client";

import { useEffect, useId, useState } from "react";
import type { ClientPersona } from "@/lib/clients";
import { CLIENTS } from "@/lib/clients";
import { listScenarios } from "@/lib/api/client";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { VoiceAuthGate } from "@/app/components/VoiceAuthGate";
import { registerVerifiedVoiceUser } from "@/lib/auth/voice-session";
import { useAuth } from "@/lib/auth/context";
import {
  canStartTraining,
  startBlockedReason,
  DIFFICULTY_LABELS,
  MODE_LABELS,
} from "@/lib/frontend/training-readiness";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Spinner } from "@/app/components/ui/Spinner";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";

export interface SetupConfig {
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  totalRounds: number;
  verifiedUserId?: string;
  verifiedEmail?: string;
  client?: ClientPersona;
}

interface ScenarioHubProps {
  onStart: (config: SetupConfig) => void;
  onCreateScenario: () => void;
  refreshKey?: number;
  selectedSlugOnLoad?: string | null;
  isStarting?: boolean;
}

type ScenarioTab = "library" | "custom";

export function ScenarioHub({
  onStart,
  onCreateScenario,
  refreshKey = 0,
  selectedSlugOnLoad = null,
  isStarting = false,
}: ScenarioHubProps) {
  const [tab, setTab] = useState<ScenarioTab>("library");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [mode, setMode] = useState<PracticeMode>("voz");
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [micVerified, setMicVerified] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [voiceAuthSkipped, setVoiceAuthSkipped] = useState(false);
  const speech = useSpeechRecognition();
  const voiceConfig = useVoiceConfig();
  const { session } = useAuth();
  const difficultyGroupId = useId();

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
    setLoadingScenarios(true);
    void listScenarios()
      .then(setScenarios)
      .finally(() => setLoadingScenarios(false));
  }, [refreshKey]);

  useEffect(() => {
    if (selectedSlugOnLoad) {
      setSelectedSlug(selectedSlugOnLoad);
      setTab("custom");
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

  const visibleScenarios = tab === "library" ? displayPresets : custom;

  const selected =
    scenarios.find((s) => s.slug === selectedSlug) ??
    displayPresets.find((s) => s.slug === selectedSlug) ??
    null;

  const selectedClient = CLIENTS.find((c) => c.slug === selectedSlug) ?? null;

  const needsVoiceAuth =
    mode === "voz" &&
    voiceConfig.requiresVoiceAuth &&
    !voiceAuthSkipped &&
    !verifiedUserId;

  const readiness = {
    scenarioSelected: selected !== null,
    mode,
    speechSupported: speech.supported,
    micVerified,
    isStarting,
    needsVoiceAuth,
    voiceAuthVerified: Boolean(verifiedUserId),
  };

  const canStart = canStartTraining(readiness);
  const blockedReason = startBlockedReason(readiness);

  const handleMicTest = () => {
    if (mode !== "voz" || !speech.supported) return;
    speech.startListening();
    setMicVerified(true);
  };

  const handleStart = () => {
    if (!selected || !canStart) return;
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

  const renderScenarioCard = (scenario: ScenarioRecord) => {
    const isSelected = selectedSlug === scenario.slug;
    return (
      <Card
        key={scenario.slug}
        interactive
        selected={isSelected}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => setSelectedSlug(scenario.slug)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedSlug(scenario.slug);
          }
        }}
      >
        <div className="scenario-card__head">
          <h3 className="scenario-card__name">{scenario.clientName}</h3>
          <span
            className={`chip ${scenario.isPreset ? "chip--preset" : "chip--custom"}`}
          >
            {scenario.isPreset
              ? scenario.difficultyLabel ?? "Preset"
              : scenario.industry ?? "Personalizado"}
          </span>
        </div>
        <p className="scenario-card__role">
          {scenario.clientTitle} · {scenario.companyContext}
        </p>
        <p className="scenario-card__hint">
          {scenario.isPreset
            ? `Indicador: ${scenario.indicator}`
            : `Vende: ${scenario.productSold}`}
        </p>
        {(scenario.painPoints ?? []).length > 0 ? (
          <ul className="scenario-card__pains">
            {(scenario.painPoints ?? []).slice(0, 2).map((pain) => (
              <li key={pain}>{pain}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    );
  };

  return (
    <div className="train-hub">
      <header className="page-hero">
        <p className="page-hero__eyebrow">Tu sesión de práctica</p>
        <h1 className="page-hero__title">Elige un escenario y empieza</h1>
        <p className="page-hero__subtitle">
          Cinco rondas por llamada: apertura, objeción, claridad, seguimiento y
          cierre. Gana con día y hora concretos — o tu propio criterio de éxito.
        </p>
      </header>

      <div className="train-hub__tabs" role="tablist" aria-label="Tipo de escenario">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "library"}
          className={`train-hub__tab ${tab === "library" ? "train-hub__tab--active" : ""}`}
          onClick={() => setTab("library")}
        >
          Biblioteca
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "custom"}
          className={`train-hub__tab ${tab === "custom" ? "train-hub__tab--active" : ""}`}
          onClick={() => setTab("custom")}
        >
          Mis escenarios
        </button>
      </div>

      {loadingScenarios ? (
        <div className="train-hub__loading">
          <Spinner label="Cargando escenarios…" />
        </div>
      ) : tab === "custom" && custom.length === 0 ? (
        <EmptyState
          title="Aún no tienes escenarios propios"
          description="Crea un caso de venta a tu medida — banco, SaaS, seguros, retail — y practícalo con el mismo motor de cinco rondas."
          actionLabel="Crear escenario"
          onAction={onCreateScenario}
        />
      ) : visibleScenarios.length === 0 ? (
        <EmptyState
          title="No hay escenarios disponibles"
          description="Vuelve a intentar en unos segundos o crea uno personalizado."
          actionLabel="Crear escenario"
          onAction={onCreateScenario}
        />
      ) : (
        <div className="scenario-grid" role="list">
          {visibleScenarios.map(renderScenarioCard)}
        </div>
      )}

      {tab === "custom" && custom.length > 0 ? (
        <div className="train-hub__secondary-action">
          <Button variant="ghost" onClick={onCreateScenario}>
            + Crear otro escenario
          </Button>
        </div>
      ) : null}

      <aside className="config-panel" aria-label="Configuración de la llamada">
        <div className="config-panel__section">
          <Switch
            label="Modo voz"
            description={
              mode === "voz"
                ? "Habla con el micrófono o escribe"
                : "Solo texto — sin micrófono"
            }
            checked={mode === "voz"}
            onCheckedChange={(on) => {
              setMode(on ? "voz" : "texto");
              if (!on) setMicVerified(false);
            }}
          />
        </div>

        <div className="config-panel__section">
          <SegmentedControl
            label="Dificultad"
            labelId={difficultyGroupId}
            value={String(level) as "1" | "2" | "3"}
            options={([1, 2, 3] as const).map((n) => ({
              value: String(n),
              label: DIFFICULTY_LABELS[n],
            }))}
            onChange={(v) => setLevel(Number(v) as DifficultyLevel)}
          />
        </div>

        {mode === "voz" && needsVoiceAuth ? (
          <div className="config-panel__section">
            <VoiceAuthGate
              onVerified={(id, email) => {
                setVerifiedUserId(id);
                setVerifiedEmail(email);
              }}
              onSkip={() => setVoiceAuthSkipped(true)}
            />
          </div>
        ) : null}

        {mode === "voz" ? (
          <div className="config-panel__section config-panel__mic">
            <span className="config-panel__label">Micrófono</span>
            {!speech.supported ? (
              <p className="config-panel__hint config-panel__hint--warn">
                Web Speech no disponible. Usa modo texto o Chrome/Edge.
              </p>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={handleMicTest}
                  disabled={speech.listening}
                >
                  {speech.listening ? "Escuchando…" : "Probar micrófono"}
                </Button>
                {speech.transcript ? (
                  <p className="config-panel__hint">
                    Escuché: &ldquo;{speech.transcript}&rdquo;
                  </p>
                ) : null}
                {speech.error ? (
                  <p className="config-panel__hint config-panel__hint--warn">
                    {speech.error}
                  </p>
                ) : null}
                {micVerified && !speech.error ? (
                  <p className="config-panel__hint config-panel__hint--ok">
                    Micrófono listo.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </aside>

      <div className="start-bar">
        <div className="start-bar__meta">
          {selected ? (
            <p>
              Listo para llamar a <strong>{selected.clientName}</strong> ·{" "}
              {MODE_LABELS[mode]} · {DIFFICULTY_LABELS[level]}
            </p>
          ) : (
            <p className="start-bar__hint">Selecciona un escenario arriba</p>
          )}
          {blockedReason && !canStart ? (
            <p className="start-bar__blocked" role="status">
              {blockedReason}
            </p>
          ) : null}
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={!canStart}
          loading={isStarting}
          onClick={handleStart}
        >
          Iniciar llamada
        </Button>
      </div>
    </div>
  );
}
