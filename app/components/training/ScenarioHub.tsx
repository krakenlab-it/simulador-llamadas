"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useDocumentLang } from "@/lib/a11y/document-lang";
import { nextRovingValue } from "@/lib/a11y/roving-options";
import { useToast } from "@/components/ui/Toast";
import { CLIENTS, getClientBySlug, type ClientPersona } from "@/lib/clients";
import { listScenarios, saveScenarioVoiceAgent } from "@/lib/api/client";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import { resolveHubVoiceAgent } from "@/lib/scenarios/catalog-defaults";
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  parseVoiceAgentSettings,
  type VoiceAgentSettings,
} from "@/lib/voice/agent-settings";
import { DEFAULT_CLIENT_LAYER_SETTINGS } from "@/lib/agent/client-layer";
import { describeClientLayerForTrainer } from "@/lib/agent/client-pack";
import { VoiceAgentControls } from "@/app/components/training/VoiceAgentControls";
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
import {
  difficultyCoachHint,
  hubDifficultyHint,
} from "@/lib/frontend/training-copy";
import { normalizeDifficultyEtiqueta } from "@/lib/scenarios/difficulty-etiquette";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Spinner } from "@/app/components/ui/Spinner";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";
import { unlockClientPlayback } from "@/lib/voice/client-playback";
import {
  normalizeAuthoringLanguage,
  openingLineForCall,
  phaseLabelsForCall,
  scoringPhaseCount,
} from "@/lib/scenarios/authoring";
import { difficultyLevelFromEtiqueta } from "@/lib/scenarios/difficulty-etiquette";
import { getClientLine } from "@/lib/simulation/rounds";

export interface SetupConfig {
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  totalRounds: number;
  phaseLabels: string[];
  openingLine?: string;
  verifiedUserId?: string;
  verifiedEmail?: string;
  client?: ClientPersona;
  voiceAgent: VoiceAgentSettings;
  temperament?: string;
  difficultyLabel?: string;
}

interface ScenarioHubProps {
  onStart: (config: SetupConfig) => void;
  onCreateScenario: () => void;
  onEditScenario: (scenario: ScenarioRecord) => void;
  refreshKey?: number;
  selectedSlugOnLoad?: string | null;
  isStarting?: boolean;
  /** Capacitador prueba calidad; agente solo ve asignados y voz por defecto. */
  hubMode?: "capacitador" | "agente";
  /** When set (agente), only these scenario slugs are listed. */
  assignedScenarioSlugs?: string[] | null;
}

type ScenarioTab = "library" | "custom";

export function ScenarioHub({
  onStart,
  onCreateScenario,
  onEditScenario,
  refreshKey = 0,
  selectedSlugOnLoad = null,
  isStarting = false,
  hubMode = "capacitador",
  assignedScenarioSlugs = null,
}: ScenarioHubProps) {
  const isAgenteHub = hubMode === "agente";
  const [tab, setTab] = useState<ScenarioTab>("library");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [savingVoiceAgent, setSavingVoiceAgent] = useState(false);
  const { showToast } = useToast();
  const [mode, setMode] = useState<PracticeMode>("voz");
  const [level, setLevel] = useState<DifficultyLevel>(1);
  const [voiceAgent, setVoiceAgent] = useState<VoiceAgentSettings>(
    DEFAULT_VOICE_AGENT_SETTINGS,
  );
  const [micVerified, setMicVerified] = useState(false);
  const [micTestActive, setMicTestActive] = useState(false);
  const micTestStartedAtRef = useRef<number | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [voiceAuthSkipped, setVoiceAuthSkipped] = useState(false);
  const speech = useSpeechRecognition();
  const voiceConfig = useVoiceConfig();
  const { session } = useAuth();
  const difficultyGroupId = useId();
  const libraryTabId = useId();
  const customTabId = useId();
  const scenarioPanelId = useId();
  useDocumentLang(voiceAgent.language);

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
    setCatalogFailed(false);
    void listScenarios()
      .then((rows) => {
        setScenarios(rows);
        setCatalogFailed(false);
      })
      .catch(() => {
        setScenarios([]);
        setCatalogFailed(true);
      })
      .finally(() => setLoadingScenarios(false));
  }, [refreshKey]);

  useEffect(() => {
    if (isAgenteHub) {
      setMode("voz");
    }
  }, [isAgenteHub]);

  useEffect(() => {
    if (selectedSlugOnLoad) {
      setSelectedSlug(selectedSlugOnLoad);
      setTab(isAgenteHub ? "library" : "custom");
    }
  }, [selectedSlugOnLoad, refreshKey, isAgenteHub]);

  const filterAssigned = (list: ScenarioRecord[]) => {
    if (!isAgenteHub || !assignedScenarioSlugs?.length) return list;
    const allowed = new Set(assignedScenarioSlugs);
    return list.filter((s) => allowed.has(s.slug));
  };

  const presets = filterAssigned(scenarios.filter((s) => s.isPreset));
  const custom = filterAssigned(scenarios.filter((s) => !s.isPreset));
  const displayPresets =
    catalogFailed
      ? []
      : presets.length > 0
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
              language: "es",
              config: { rounds: [] },
            }) as unknown as ScenarioRecord,
        );

  const agenteScenarios = useMemo(() => {
    const bySlug = new Map<string, ScenarioRecord>();
    for (const s of [...displayPresets, ...custom]) {
      bySlug.set(s.slug, s);
    }
    return [...bySlug.values()];
  }, [displayPresets, custom]);

  const visibleScenarios = isAgenteHub
    ? agenteScenarios
    : tab === "library"
      ? displayPresets
      : custom;

  const selected =
    scenarios.find((s) => s.slug === selectedSlug) ??
    displayPresets.find((s) => s.slug === selectedSlug) ??
    null;

  const selectedClient = CLIENTS.find((c) => c.slug === selectedSlug) ?? null;

  useEffect(() => {
    if (!selected) return;
    const restored = resolveHubVoiceAgent(selected);
    setVoiceAgent(restored);
    setLevel(restored.difficultyLevel);
  }, [selected]);

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
    isStarting: isStarting || savingVoiceAgent,
    needsVoiceAuth,
    voiceAuthVerified: Boolean(verifiedUserId),
  };

  const canStart = canStartTraining(readiness);
  const blockedReason = startBlockedReason(readiness);

  const handleMicTest = () => {
    if (mode !== "voz" || !speech.supported) return;
    unlockClientPlayback();
    setMicTestActive(true);
    setMicVerified(false);
    micTestStartedAtRef.current = Date.now();
    speech.startListening();
  };

  useEffect(() => {
    if (!micTestActive || speech.listening) return;
    const heard = Boolean(speech.transcript?.trim());
    if (heard) {
      setMicVerified(true);
      setMicTestActive(false);
      return;
    }
    if (speech.error) {
      setMicVerified(false);
      setMicTestActive(false);
      return;
    }
    const elapsed = micTestStartedAtRef.current
      ? Date.now() - micTestStartedAtRef.current
      : 0;
    if (elapsed > 800) {
      setMicVerified(false);
      setMicTestActive(false);
    }
  }, [
    micTestActive,
    speech.listening,
    speech.transcript,
    speech.error,
  ]);

  const micHelpText = (() => {
    if (!speech.error) return null;
    if (/not-allowed|permission/i.test(speech.error)) {
      return "Permiso bloqueado: en Chrome/Edge abre el candado junto a la URL → Micrófono → Permitir. En el celular revisa Ajustes → Privacidad → Micrófono para el navegador.";
    }
    if (/no-speech/i.test(speech.error)) {
      return "No se escuchó voz. Habla cerca del micrófono o revisa que el dispositivo correcto esté seleccionado en el sistema.";
    }
    return speech.error;
  })();

  const selectScenario = (scenario: ScenarioRecord) => {
    setSelectedSlug(scenario.slug);
    const language = normalizeAuthoringLanguage(
      scenario.language ?? scenario.config.language,
    );
    setLevel(difficultyLevelFromEtiqueta(scenario.difficultyLabel, language));
  };

  const handleStart = async () => {
    if (!selected || !canStart || savingVoiceAgent) return;
    unlockClientPlayback();
    const settings = parseVoiceAgentSettings({
      ...voiceAgent,
      difficultyLevel: level,
    });
    setSavingVoiceAgent(true);
    try {
      await saveScenarioVoiceAgent(selected.slug, settings);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No se pudieron guardar los ajustes de voz.";
      showToast(message, "error");
      setSavingVoiceAgent(false);
      return;
    }
    setSavingVoiceAgent(false);
    const presetLine =
      selected.isPreset && selectedClient
        ? getClientLine(selectedClient, 0)
        : undefined;
    onStart({
      scenarioSlug: selected.slug,
      clientName: selected.clientName,
      isPreset: selected.isPreset,
      mode,
      difficultyLevel: level,
      totalRounds: scoringPhaseCount(selected.config, selected.isPreset),
      phaseLabels: phaseLabelsForCall(selected.config, selected.isPreset),
      openingLine: openingLineForCall(
        selected.config,
        selected.isPreset,
        presetLine,
      ),
      client: selectedClient ?? undefined,
      verifiedUserId: verifiedUserId ?? undefined,
      verifiedEmail: verifiedEmail ?? undefined,
      voiceAgent: settings,
      temperament: selected.temperament ?? selected.config.temperament,
      difficultyLabel: selected.difficultyLabel,
    });
  };

  const renderScenarioCard = (scenario: ScenarioRecord) => {
    const isSelected = selectedSlug === scenario.slug;
    return (
      <div key={scenario.slug} className="scenario-card-wrap" role="listitem">
        <Card
          interactive
          selected={isSelected}
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          aria-label={`Escenario ${scenario.clientName}`}
          onClick={() => selectScenario(scenario)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectScenario(scenario);
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
              ? getClientBySlug(scenario.slug)?.practiceBrief ??
                `Indicador: ${scenario.indicator}`
              : `Vende: ${scenario.productSold}`}
          </p>
          {!scenario.isPreset ? (
            <p className="scenario-card__tags">
              <span className="scenario-card__tag">
                {scenario.temperament ?? "Temperamento"}
              </span>
              <span className="scenario-card__tag">
                {normalizeDifficultyEtiqueta(
                  scenario.difficultyLabel,
                  normalizeAuthoringLanguage(scenario.language),
                )}
              </span>
            </p>
          ) : null}
        </Card>
        {!scenario.isPreset && !isAgenteHub ? (
          <div className="scenario-card__actions">
            <Button variant="ghost" onClick={() => onEditScenario(scenario)}>
              Editar {scenario.clientName}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="train-hub">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">
          {isAgenteHub ? "Agente · Practicar" : "Capacitador · Escenarios"}
        </p>
        <h1 className="page-hero__title">
          {isAgenteHub
            ? "Simulación de llamada por voz"
            : "Arma y prueba la llamada"}
        </h1>
        <p className="page-hero__subtitle">
          {isAgenteHub
            ? "Solo verás escenarios asignados por tu capacitador. Habla por micrófono; el cliente responde en vivo y el coaching va aparte."
            : "Elige el comprador, ajusta dificultad y voz, y valida la experiencia antes de asignarla al equipo."}
        </p>
      </header>

      <div className="train-hub__layout">
        <div className="train-hub__main">
      <div
        className="train-hub__tabs"
        role="tablist"
        aria-label="Tipo de escenario"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const next = nextRovingValue(
            ["library", "custom"] as const,
            tab,
            event.key,
          );
          if (!next) return;
          event.preventDefault();
          setTab(next);
        }}
      >
        <button
          type="button"
          id={libraryTabId}
          role="tab"
          aria-selected={tab === "library"}
          aria-controls={scenarioPanelId}
          tabIndex={tab === "library" ? 0 : -1}
          className={`train-hub__tab ${tab === "library" ? "train-hub__tab--active" : ""}`}
          onClick={() => setTab("library")}
        >
          Biblioteca
        </button>
        {!isAgenteHub ? (
          <button
            type="button"
            id={customTabId}
            role="tab"
            aria-selected={tab === "custom"}
            aria-controls={scenarioPanelId}
            tabIndex={tab === "custom" ? 0 : -1}
            className={`train-hub__tab ${tab === "custom" ? "train-hub__tab--active" : ""}`}
            onClick={() => setTab("custom")}
          >
            Mis escenarios
          </button>
        ) : null}
      </div>

      <div
        id={scenarioPanelId}
        role="tabpanel"
        aria-labelledby={tab === "library" ? libraryTabId : customTabId}
      >
        {loadingScenarios ? (
          <div className="train-hub__loading">
            <Spinner label="Cargando escenarios…" />
          </div>
        ) : catalogFailed ? (
          <EmptyState
            title="No se pudieron cargar los escenarios"
            description="El catálogo no respondió. Revisa la conexión e inténtalo de nuevo — no arrancamos la clínica de respaldo para no ensayar un caso distinto al de producción."
          />
        ) : isAgenteHub && (!assignedScenarioSlugs || assignedScenarioSlugs.length === 0) ? (
          <EmptyState
            title="Sin escenarios asignados"
            description="Tu capacitador aún no te asignó casos en este proyecto. Vuelve al inicio o pídele que te agregue en Agentes."
          />
        ) : tab === "custom" && custom.length === 0 && !isAgenteHub ? (
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
      </div>

      {!isAgenteHub && tab === "custom" && custom.length > 0 ? (
        <div className="train-hub__secondary-action">
          <Button variant="ghost" onClick={onCreateScenario}>
            + Crear otro escenario
          </Button>
        </div>
      ) : null}
        </div>

        <div className="train-hub__aside">
      {selected ? (
        <div className="train-session-card" aria-label="Resumen del comprador">
          <p className="train-session-card__eyebrow">Comprador seleccionado</p>
          <h2 className="train-session-card__name">{selected.clientName}</h2>
          <p className="train-session-card__role">
            {selected.clientTitle} · {selected.companyContext}
          </p>
          <ul className="train-session-card__chips">
            <li>{selected.temperament ?? selected.config.temperament}</li>
            <li>
              {normalizeDifficultyEtiqueta(
                selected.difficultyLabel,
                normalizeAuthoringLanguage(selected.language),
              )}
            </li>
            <li>{MODE_LABELS[mode]}</li>
          </ul>
          <p className="train-session-card__hint">
            {difficultyCoachHint(
              selected.difficultyLabel ?? "Intermedio",
              normalizeAuthoringLanguage(selected.language),
            )}
          </p>
        </div>
      ) : (
        <div className="train-session-card train-session-card--empty">
          <p>Elige un escenario para ver el perfil del comprador y armar la llamada.</p>
        </div>
      )}

      <aside className="config-panel config-panel--stacked" aria-label="Configuración de la llamada">
        <h2 className="config-panel__title">Antes de marcar</h2>
        {!isAgenteHub ? (
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
        ) : (
          <p className="config-panel__hint config-panel__hint--ok">
            Modo voz activo — el agente practica como en una llamada real.
          </p>
        )}

        <div className="config-panel__section">
          <SegmentedControl
            label="Dificultad"
            labelId={difficultyGroupId}
            value={String(level) as "1" | "2" | "3"}
            options={([1, 2, 3] as const).map((n) => ({
              value: String(n),
              label: DIFFICULTY_LABELS[n],
            }))}
            onChange={(v) => {
              const next = Number(v) as DifficultyLevel;
              setLevel(next);
              setVoiceAgent((prev) => ({ ...prev, difficultyLevel: next }));
            }}
          />
          <p className="config-panel__hint">{hubDifficultyHint(level)}</p>
        </div>

        <p className="config-panel__hint">
          {describeClientLayerForTrainer(
            voiceAgent.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS,
          )}
        </p>

        <VoiceAgentControls
          value={voiceAgent}
          onChange={(next) => {
            setVoiceAgent(next);
            setLevel(next.difficultyLevel);
          }}
          showBargeIn={mode === "voz"}
        />

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
                {speech.transcript && !micVerified ? (
                  <p className="config-panel__hint">
                    Escuché: &ldquo;{speech.transcript}&rdquo;
                  </p>
                ) : null}
                {micHelpText ? (
                  <p className="config-panel__hint config-panel__hint--warn">
                    {micHelpText}
                  </p>
                ) : null}
                {micVerified && !speech.error ? (
                  <p className="config-panel__hint config-panel__hint--ok">
                    Prueba exitosa: el micrófono está escuchando.
                    {speech.transcript ? ` Escuché: «${speech.transcript}»` : ""}
                  </p>
                ) : null}
                {!micVerified && micHelpText ? (
                  <p className="config-panel__hint config-panel__hint--warn">
                    {micHelpText}
                  </p>
                ) : null}
                {!micVerified &&
                micTestActive === false &&
                !speech.error &&
                !speech.transcript ? (
                  <p className="config-panel__hint">
                    Pulsa probar y di una frase corta. Si no hay audio, revisa
                    permisos del navegador y el micrófono del sistema.
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
          loading={isStarting || savingVoiceAgent}
          onClick={() => void handleStart()}
        >
          Iniciar llamada
        </Button>
      </div>
        </div>
      </div>
    </div>
  );
}
