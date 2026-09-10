"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import {
  DIFFICULTY_DESCRIPTIONS,
  KRAKEN_PROJECT_LABELS,
  KRAKEN_SIMULACION_PRODUCT_NAME,
  NUEVA_SIMULACION_CTA_LABEL,
  SIMULATION_FOCUS_LABELS,
  SIMULATOR_ROLE_LABELS,
  WIZARD_STEP_LABELS,
  WIZARD_STEPS,
  type WizardStep,
} from "@/lib/kraken-lab/constants";
import {
  enrichCohortWithPersonas,
  generateReceiverPersonas,
  mintFreshSessionSeed,
} from "@/lib/kraken-lab/generator";
import type {
  KrakenLabCohortConfig,
  KrakenLabProject,
  SimulationFocus,
  SimulatorRole,
} from "@/lib/kraken-lab/types";
import { ReceiverPersonaCard } from "@/app/components/kraken-lab/ReceiverPersonaCard";
import { ScenarioContextUploadPanel } from "@/app/components/kraken-lab/ScenarioContextUploadPanel";
import { ParticipantCvUpload } from "@/app/components/kraken-lab/ParticipantCvUpload";
import { ParticipantSimulationCitiesField } from "@/app/components/kraken-lab/ParticipantSimulationCitiesField";
import { SelectWithOther } from "@/app/components/ui/SelectWithOther";
import { INDUSTRY_OPTIONS } from "@/lib/scenarios/select-options";
import {
  buildIndustryAwareBrief,
  inferContextIndustryFromBrief,
  shouldConfirmIndustryBriefOverwrite,
} from "@/lib/kraken-lab/context-from-industry";
import { useToast } from "@/components/ui/Toast";
import {
  canAdvanceWizardStep,
  defaultCohortDraft,
  syncDialogueTypesToFocuses,
  syncParticipantsToCount,
  validateWizardStep,
} from "@/lib/kraken-lab/validation";
import { startKrakenSession } from "@/lib/api/kraken-lab";
import { readAgenticRuntimeForSession, isAgenticEnabledForSimulations } from "@/lib/agentic/settings";
import { AGENTIC_GROUNDING_PENDING_MESSAGE } from "@/lib/agentic/scenario-context-text";
import { hasMinimumKrakenAgenticGrounding } from "@/lib/kraken-lab/context-anchors";
import {
  clearWizardDraftFromStorage,
  loadWizardDraftFromStorage,
  participantCountChangeNeedsConfirm,
  saveWizardDraftToStorage,
  wizardDraftHasSavedContent,
} from "@/lib/kraken-lab/wizard-draft-storage";
import {
  seedWizardScenarioContextFromPriorPractice,
  shouldOfferPriorPracticeContextSeed,
} from "@/lib/kraken-lab/practice-context-seed";
import {
  getProjectContextPack,
  getProjectIndustry,
  migrateLegacyProjectContextPacks,
  prepareWizardDraftForSessionStart,
  resolveActiveProject,
  switchProjectContextPack,
  updateActiveProjectIndustryPack,
  updateProjectScenarioContext,
} from "@/lib/kraken-lab/project-context-packs";
import { DIFFICULTY_LABELS, MODE_LABELS } from "@/lib/frontend/training-readiness";
import {
  openingLineForCall,
  phaseLabelsForCall,
} from "@/lib/scenarios/authoring";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";
import type { SetupConfig } from "@/app/components/training/ScenarioHub";
import { StepNavPopover } from "@/app/components/ui/StepNavPopover";
import { summarizeKrakenWizardStep } from "@/lib/kraken-lab/wizard-step-summaries";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";

interface KrakenLabWizardProps {
  isStarting?: boolean;
  traineeId?: string | null;
  traineeEmail?: string | null;
  traineeAuthUserId?: string;
  traineeDisplayName?: string;
  onCancel: () => void;
  onStart: (
    config: SetupConfig,
    meta?: { cohortId?: string; callAttemptId?: string; traineeId?: string },
  ) => void;
}

function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

function nextStep(step: WizardStep): WizardStep {
  const idx = stepIndex(step);
  return WIZARD_STEPS[Math.min(idx + 1, WIZARD_STEPS.length - 1)];
}

function prevStep(step: WizardStep): WizardStep {
  const idx = stepIndex(step);
  return WIZARD_STEPS[Math.max(idx - 1, 0)];
}

function readInitialWizardState(): {
  draft: Partial<KrakenLabCohortConfig>;
  step: WizardStep;
  mode: PracticeMode;
  draftRecovered: boolean;
  draftTrimmed: boolean;
  contextSeeded: boolean;
} {
  const stored = loadWizardDraftFromStorage();
  const baseDraft =
    stored && wizardDraftHasSavedContent(stored.draft)
      ? migrateLegacyProjectContextPacks(stored.draft)
      : defaultCohortDraft();
  const seeded = seedWizardScenarioContextFromPriorPractice(baseDraft);
  const prepared = migrateLegacyProjectContextPacks(seeded.draft);

  return {
    draft: {
      ...prepared,
      contextIndustry:
        prepared.contextIndustry ??
        inferContextIndustryFromBrief(prepared.scenarioContext?.text ?? ""),
    },
    step: stored?.step ?? "proyecto",
    mode: stored?.mode ?? "texto",
    draftRecovered: Boolean(stored && wizardDraftHasSavedContent(stored.draft)),
    draftTrimmed: Boolean(stored?.trimmedFileBodies),
    contextSeeded: seeded.seeded,
  };
}

export function KrakenLabWizard({
  isStarting = false,
  traineeId = null,
  traineeEmail = null,
  traineeAuthUserId,
  traineeDisplayName,
  onCancel,
  onStart,
}: KrakenLabWizardProps) {
  const initialStateRef = useRef(readInitialWizardState());
  const initialState = initialStateRef.current;
  const [step, setStep] = useState<WizardStep>(initialState.step);
  const [draft, setDraft] = useState<Partial<KrakenLabCohortConfig>>(initialState.draft);
  const [mode, setMode] = useState<PracticeMode>(initialState.mode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(initialState.draftRecovered);
  const [draftTrimmed, setDraftTrimmed] = useState(initialState.draftTrimmed);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const difficultyGroupId = useId();
  const { showToast } = useToast();
  const recoveryToastShown = useRef(false);
  const contextSeedToastShown = useRef(initialState.contextSeeded);
  const trimToastShown = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAutosaveReady(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftRecovered || recoveryToastShown.current) return;
    recoveryToastShown.current = true;
    showToast("Borrador recuperado", "info");
  }, [draftRecovered, showToast]);

  useEffect(() => {
    if (!initialState.contextSeeded || contextSeedToastShown.current) return;
    contextSeedToastShown.current = true;
    showToast("Recuperamos el contexto de tu práctica anterior.", "info");
  }, [initialState.contextSeeded, showToast]);

  useEffect(() => {
    if (!autosaveReady) return;
    const timer = window.setTimeout(() => {
      const result = saveWizardDraftToStorage({ step, mode, draft });
      if (result.trimmed && !trimToastShown.current) {
        trimToastShown.current = true;
        setDraftTrimmed(true);
        showToast(
          "Guardamos nombres de archivo; el texto largo se recortó por espacio.",
          "info",
        );
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, step, mode, autosaveReady, showToast]);

  const issues = useMemo(() => validateWizardStep(step, draft), [step, draft]);
  const agenticGroundingIssues = useMemo(() => {
    if (!isAgenticEnabledForSimulations()) return [];
    if (hasMinimumKrakenAgenticGrounding(draft as KrakenLabCohortConfig)) return [];
    return [{ field: "agentic.grounding", message: AGENTIC_GROUNDING_PENDING_MESSAGE }];
  }, [draft]);
  const visibleIssues = useMemo(
    () => [...issues, ...agenticGroundingIssues],
    [issues, agenticGroundingIssues],
  );
  const canAdvance = issues.length === 0;
  const activeProject = resolveActiveProject(draft);
  const activeScenarioContext = useMemo(
    () => getProjectContextPack(draft, activeProject),
    [draft, activeProject],
  );
  const activeIndustry = useMemo(
    () => getProjectIndustry(draft, activeProject),
    [draft, activeProject],
  );

  const updateDraft = useCallback(
    (patch: Partial<KrakenLabCohortConfig>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleProjectSwitch = useCallback(
    (nextProject: KrakenLabProject) => {
      setDraft((prev) => switchProjectContextPack(prev, nextProject));
    },
    [],
  );

  const handleScenarioContextChange = useCallback(
    (
      scenarioContext: NonNullable<KrakenLabCohortConfig["scenarioContext"]>,
      forProject?: KrakenLabProject,
    ) => {
      setDraft((prev) => {
        const targetProject = forProject ?? resolveActiveProject(prev);
        return updateProjectScenarioContext(prev, targetProject, scenarioContext);
      });
    },
    [],
  );

  const handleClearDraft = useCallback(() => {
    if (
      !window.confirm(
        "¿Limpiar el borrador guardado? Se perderá la documentación y perfiles cargados.",
      )
    ) {
      return;
    }
    clearWizardDraftFromStorage();
    setDraft(defaultCohortDraft());
    setStep("proyecto");
    setMode("texto");
    setDraftRecovered(false);
    setDraftTrimmed(false);
    showToast("Borrador eliminado", "info");
  }, [showToast]);

  const handleSeedPriorPracticeContext = useCallback(() => {
    const seeded = seedWizardScenarioContextFromPriorPractice(draft);
    if (!seeded.seeded) {
      showToast("No encontramos una práctica anterior con contexto guardado.", "info");
      return;
    }
    updateDraft({
      ...seeded.draft,
      scenarioContext: seeded.draft.scenarioContext,
      scenarioContextByProject: seeded.draft.scenarioContextByProject,
      contextIndustry:
        seeded.draft.contextIndustry ??
        inferContextIndustryFromBrief(seeded.draft.scenarioContext?.text ?? ""),
      contextIndustryByProject: seeded.draft.contextIndustryByProject,
    });
    showToast("Recuperamos el contexto de tu práctica anterior.", "info");
  }, [draft, showToast, updateDraft]);

  const handleContextIndustryChange = useCallback(
    (industry: string) => {
      const trimmed = industry.trim();
      if (!trimmed) {
        setDraft((prev) =>
          updateActiveProjectIndustryPack(
            prev,
            "",
            getProjectContextPack(prev, resolveActiveProject(prev)),
          ),
        );
        return;
      }

      const previousIndustry = activeIndustry;
      const existingText = activeScenarioContext.text ?? "";
      if (
        previousIndustry &&
        previousIndustry !== trimmed &&
        shouldConfirmIndustryBriefOverwrite(existingText) &&
        !window.confirm(
          "¿Actualizar el problema al contexto de la nueva industria? Se conservan Cliente y Producto.",
        )
      ) {
        setDraft((prev) =>
          updateActiveProjectIndustryPack(
            prev,
            trimmed,
            getProjectContextPack(prev, resolveActiveProject(prev)),
          ),
        );
        return;
      }

      const fileTexts = (activeScenarioContext.files ?? [])
        .map((file) => file.text)
        .filter(Boolean);
      const nextText = buildIndustryAwareBrief({
        industry: trimmed,
        existingText,
        fileTexts,
      });

      setDraft((prev) =>
        updateActiveProjectIndustryPack(prev, trimmed, {
          ...getProjectContextPack(prev, resolveActiveProject(prev)),
          text: nextText,
        }),
      );

      if (previousIndustry && previousIndustry !== trimmed) {
        showToast(`Actualizamos el problema al contexto de ${trimmed}.`, "info");
      }
    },
    [activeIndustry, activeScenarioContext, showToast],
  );

  const handleGeneratePersonas = (regenerate = false) => {
    const seed = regenerate ? mintFreshSessionSeed() : draft.sessionSeed?.trim() || mintFreshSessionSeed();
    const base: KrakenLabCohortConfig = {
      ...(draft as KrakenLabCohortConfig),
      sessionSeed: seed,
      receiverPersonas: [],
    };
    const personas = generateReceiverPersonas(base, 3);
    updateDraft({
      sessionSeed: seed,
      receiverPersonas: personas,
      selectedPersonaId: personas[0]?.id,
    });
  };

  const handleStart = async () => {
    if (!canAdvanceWizardStep("dificultad", draft) || submitting) return;
    if (
      isAgenticEnabledForSimulations() &&
      !hasMinimumKrakenAgenticGrounding(draft as KrakenLabCohortConfig)
    ) {
      setError(AGENTIC_GROUNDING_PENDING_MESSAGE);
      return;
    }
    setSubmitting(true);
    setError(null);

    const sessionDraft = prepareWizardDraftForSessionStart(draft);
    const seed = sessionDraft.sessionSeed?.trim() || mintFreshSessionSeed();
    const cohort = enrichCohortWithPersonas({
      ...(sessionDraft as KrakenLabCohortConfig),
      sessionSeed: seed,
    });

    try {
      const remote = await startKrakenSession({
        cohort,
        mode,
        traineeId: traineeId ?? undefined,
        traineeEmail: traineeEmail ?? undefined,
        traineeAuthUserId,
        traineeDisplayName,
        agenticRuntime: readAgenticRuntimeForSession(seed),
      });

      onStart(
        {
          scenarioSlug: remote.scenarioSlug,
          clientName: remote.clientName,
          isPreset: false,
          mode,
          difficultyLevel: cohort.difficultyLevel,
          totalRounds: remote.totalRounds,
          phaseLabels: phaseLabelsForCall(remote.config, false),
          openingLine: openingLineForCall(remote.config, false),
          voiceAgent: {
            ...DEFAULT_VOICE_AGENT_SETTINGS,
            difficultyLevel: cohort.difficultyLevel,
          },
        },
        {
          cohortId: remote.cohortId,
          callAttemptId: remote.callAttemptId,
          traineeId: remote.traineeId,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la simulación.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderProjectStep = () => (
    <div className="wizard-grid">
      {(Object.keys(KRAKEN_PROJECT_LABELS) as KrakenLabProject[]).map((project) => (
        <Card
          key={project}
          interactive
          selected={draft.project === project}
          className="wizard-choice-card"
          role="button"
          tabIndex={0}
          aria-pressed={draft.project === project}
          onClick={() => handleProjectSwitch(project)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleProjectSwitch(project);
            }
          }}
        >
          <h3>{KRAKEN_PROJECT_LABELS[project]}</h3>
        </Card>
      ))}
      {draft.project === "otro" ? (
        <label className="field">
          <span>Nombre del proyecto</span>
          <input
            value={draft.projectOther ?? ""}
            onChange={(e) => updateDraft({ projectOther: e.target.value })}
            placeholder="Ej. Proyecto piloto Q3"
          />
        </label>
      ) : null}

      {draft.project ? (
        <div className="wizard-panel wizard-panel--context">
          <h3>Contexto del escenario</h3>
          <p className="config-panel__hint">
            Pega o sube material del producto/servicio, objeciones típicas o guiones de
            referencia. Lo usamos para generar personas y diálogos más humanos.
          </p>
          <SelectWithOther
            label="Industria"
            value={activeIndustry}
            options={INDUSTRY_OPTIONS}
            onChange={handleContextIndustryChange}
            placeholder="Selecciona la industria del escenario"
            otherPlaceholder="Ej. taller de llantas, cooperativa agrícola"
          />
          <ScenarioContextUploadPanel
            key={activeProject}
            activeProject={activeProject}
            value={activeScenarioContext}
            onChange={handleScenarioContextChange}
            onToast={(message, tone) => showToast(message, tone)}
          />
          {shouldOfferPriorPracticeContextSeed(draft) ? (
            <Button
              type="button"
              variant="secondary"
              className="wizard-panel__seed-context"
              onClick={handleSeedPriorPracticeContext}
            >
              Usar datos de la práctica anterior
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderParticipantsStep = () => (
    <div className="wizard-panel">
      <label className="field">
        <span>¿Cuántas personas practican? (1–12)</span>
        <input
          type="number"
          min={1}
          max={12}
          value={draft.participantCount ?? 1}
          onChange={(e) => {
            const count = Math.min(12, Math.max(1, Number(e.target.value) || 1));
            const currentCount = draft.participantCount ?? 1;
            if (
              participantCountChangeNeedsConfirm(
                currentCount,
                count,
                draft.participants,
              )
            ) {
              const removed = (draft.participants?.length ?? 0) - count;
              const ok = window.confirm(
                `¿Reducir a ${count} participante${count === 1 ? "" : "s"}? Se perderán ${removed} perfil${removed === 1 ? "" : "es"}.`,
              );
              if (!ok) return;
            }
            updateDraft({
              participantCount: count,
              participants: syncParticipantsToCount({
                ...draft,
                participantCount: count,
              }),
            });
          }}
        />
      </label>
    </div>
  );

  const renderProfilesStep = () => (
    <div className="wizard-stack">
      {(draft.participants ?? []).map((profile, index) => (
        <Card key={index} className="wizard-profile-card">
          <div className="wizard-profile-card__header">
            <h3>Participante {index + 1}</h3>
            <ParticipantCvUpload
              profile={profile}
              onProfileChange={(next) => {
                const participants = [...(draft.participants ?? [])];
                participants[index] = next;
                updateDraft({ participants });
              }}
              onToast={showToast}
            />
          </div>
          <div className="wizard-form-grid">
            <label className="field">
              <span>Nombre completo</span>
              <input
                value={profile.fullName}
                onChange={(e) => {
                  const participants = [...(draft.participants ?? [])];
                  participants[index] = { ...profile, fullName: e.target.value };
                  updateDraft({ participants });
                }}
              />
            </label>
            <label className="field">
              <span>Edad</span>
              <input
                type="number"
                min={16}
                max={80}
                value={profile.age === 0 ? "" : profile.age}
                onChange={(e) => {
                  const participants = [...(draft.participants ?? [])];
                  const raw = e.target.value;
                  participants[index] = {
                    ...profile,
                    age: raw === "" ? 0 : Number(raw),
                  };
                  updateDraft({ participants });
                }}
              />
            </label>
            <label className="field">
              <span>Ciudad de residencia</span>
              <input
                value={profile.city}
                onChange={(e) => {
                  const participants = [...(draft.participants ?? [])];
                  participants[index] = { ...profile, city: e.target.value };
                  updateDraft({ participants });
                }}
              />
            </label>
            <ParticipantSimulationCitiesField
              country={profile.simulationCountry}
              cities={profile.simulationCities}
              onChange={({ country: simulationCountry, cities: simulationCities }) => {
                const participants = [...(draft.participants ?? [])];
                participants[index] = {
                  ...profile,
                  simulationCountry,
                  simulationCities,
                };
                updateDraft({ participants });
              }}
            />
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input
                value={profile.phone}
                onChange={(e) => {
                  const participants = [...(draft.participants ?? [])];
                  participants[index] = { ...profile, phone: e.target.value };
                  updateDraft({ participants });
                }}
              />
            </label>
            <label className="field">
              <span>Correo</span>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => {
                  const participants = [...(draft.participants ?? [])];
                  participants[index] = { ...profile, email: e.target.value };
                  updateDraft({ participants });
                }}
              />
            </label>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderSimulationStep = () => (
    <div className="wizard-panel">
      <p className="config-panel__hint">Selecciona uno o más tipos de práctica.</p>
      <div className="wizard-chip-grid">
        {(Object.keys(SIMULATION_FOCUS_LABELS) as SimulationFocus[]).map((focus) => {
          const selected = (draft.simulationFocuses ?? []).includes(focus);
          return (
            <button
              key={focus}
              type="button"
              className={`chip chip--toggle ${selected ? "chip--selected" : ""}`}
              aria-pressed={selected}
              onClick={() => {
                const current = draft.simulationFocuses ?? [];
                const next = selected
                  ? current.filter((f) => f !== focus)
                  : [...current, focus];
                updateDraft({
                  simulationFocuses: next,
                  dialogueTypes: syncDialogueTypesToFocuses({
                    ...draft,
                    simulationFocuses: next,
                  }),
                });
              }}
            >
              {SIMULATION_FOCUS_LABELS[focus]}
            </button>
          );
        })}
      </div>
      {(draft.simulationFocuses ?? []).includes("otro") ? (
        <label className="field">
          <span>Describe «otro»</span>
          <input
            value={draft.simulationFocusOther ?? ""}
            onChange={(e) => updateDraft({ simulationFocusOther: e.target.value })}
          />
        </label>
      ) : null}
    </div>
  );

  const renderRoleStep = () => (
    <div className="wizard-panel">
      <div className="wizard-grid">
        {(Object.keys(SIMULATOR_ROLE_LABELS) as SimulatorRole[]).map((role) => (
          <Card
            key={role}
            interactive
            selected={draft.simulatorRole === role}
            className="wizard-choice-card"
            role="button"
            tabIndex={0}
            aria-pressed={draft.simulatorRole === role}
            onClick={() => updateDraft({ simulatorRole: role })}
          >
            <h3>{SIMULATOR_ROLE_LABELS[role]}</h3>
          </Card>
        ))}
      </div>
      <label className="field">
        <span>Objetivo de la sesión</span>
        <textarea
          rows={3}
          value={draft.roleObjective ?? ""}
          onChange={(e) => updateDraft({ roleObjective: e.target.value })}
          placeholder="Ej. Agendar demo de 15 minutos con el director de compras"
        />
      </label>
    </div>
  );

  const renderDialoguesStep = () => (
    <div className="wizard-stack">
      {(draft.dialogueTypes ?? []).map((dialogue, index) => (
        <Card key={`${dialogue.focus}-${index}`} className="wizard-profile-card">
          <h3>{SIMULATION_FOCUS_LABELS[dialogue.focus] ?? dialogue.focus}</h3>
          <label className="field">
            <span>Contexto de simulación</span>
            <textarea
              rows={2}
              value={dialogue.simulationContext}
              onChange={(e) => {
                const dialogueTypes = [...(draft.dialogueTypes ?? [])];
                dialogueTypes[index] = {
                  ...dialogue,
                  simulationContext: e.target.value,
                };
                updateDraft({ dialogueTypes });
              }}
            />
          </label>
          <label className="field">
            <span>Objetivo real</span>
            <textarea
              rows={2}
              value={dialogue.realObjective}
              onChange={(e) => {
                const dialogueTypes = [...(draft.dialogueTypes ?? [])];
                dialogueTypes[index] = { ...dialogue, realObjective: e.target.value };
                updateDraft({ dialogueTypes });
              }}
            />
          </label>
          <label className="field">
            <span>Producto / servicio / motivo</span>
            <textarea
              rows={2}
              value={dialogue.productServiceExplanation}
              onChange={(e) => {
                const dialogueTypes = [...(draft.dialogueTypes ?? [])];
                dialogueTypes[index] = {
                  ...dialogue,
                  productServiceExplanation: e.target.value,
                };
                updateDraft({ dialogueTypes });
              }}
            />
          </label>
        </Card>
      ))}
    </div>
  );

  const renderPersonasStep = () => (
    <div className="wizard-panel">
      <p className="config-panel__hint">
        Generamos tres personas receptoras distintas a partir del contexto del escenario,
        la dificultad y las ciudades. Elige con cuál practicarás.
      </p>
      <div className="wizard-actions-row">
        <Button variant="secondary" onClick={() => handleGeneratePersonas(false)}>
          Generar personas
        </Button>
        {(draft.receiverPersonas ?? []).length > 0 ? (
          <Button variant="ghost" onClick={() => handleGeneratePersonas(true)}>
            Regenerar personas
          </Button>
        ) : null}
      </div>
      <div className="wizard-persona-grid">
        {(draft.receiverPersonas ?? []).map((persona) => (
          <ReceiverPersonaCard
            key={persona.id}
            persona={persona}
            selected={draft.selectedPersonaId === persona.id}
            onSelect={() => updateDraft({ selectedPersonaId: persona.id })}
          />
        ))}
      </div>
    </div>
  );

  const renderDifficultyStep = () => (
    <div className="wizard-panel">
      <SegmentedControl
        label="Dificultad"
        labelId={difficultyGroupId}
        value={String(draft.difficultyLevel ?? 2) as "1" | "2" | "3"}
        options={([1, 2, 3] as const).map((n) => ({
          value: String(n),
          label: DIFFICULTY_LABELS[n],
        }))}
        onChange={(v) =>
          updateDraft({ difficultyLevel: Number(v) as DifficultyLevel })
        }
      />
      <p className="config-panel__hint">
        {DIFFICULTY_DESCRIPTIONS[(draft.difficultyLevel ?? 2) as 1 | 2 | 3]}
      </p>
      <div className="config-panel__section">
        <Switch
          label="Modo voz"
          description={
            mode === "voz"
              ? "Practica hablando (requiere micrófono)"
              : "Modo texto — recomendado para la primera práctica"
          }
          checked={mode === "voz"}
          onCheckedChange={(on) => setMode(on ? "voz" : "texto")}
        />
      </div>
      <p className="config-panel__hint">
        Modo: {MODE_LABELS[mode]} · Proyecto:{" "}
        {draft.project ? KRAKEN_PROJECT_LABELS[draft.project] : "—"}
      </p>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case "proyecto":
        return renderProjectStep();
      case "participantes":
        return renderParticipantsStep();
      case "perfiles":
        return renderProfilesStep();
      case "simulacion":
        return renderSimulationStep();
      case "rol":
        return renderRoleStep();
      case "dialogos":
        return renderDialoguesStep();
      case "personas":
        return renderPersonasStep();
      case "dificultad":
        return renderDifficultyStep();
      default:
        return null;
    }
  };

  const currentIndex = stepIndex(step);
  const isLast = step === "dificultad";

  return (
    <div className="train-hub kraken-wizard">
      <header className="page-hero">
        <div className="wizard-page-hero__top">
          <p className="page-hero__eyebrow">{KRAKEN_SIMULACION_PRODUCT_NAME}</p>
          <Button variant="ghost" onClick={handleClearDraft}>
            Limpiar borrador
          </Button>
        </div>
        <h1 className="page-hero__title">{NUEVA_SIMULACION_CTA_LABEL}</h1>
        <p className="page-hero__subtitle">
          Configura tu cohorte, genera una persona receptora y practica con el mismo motor
          de la Clínica de Citas — con batería de diálogo fresca por sesión.
        </p>
      </header>

      {draftRecovered ? (
        <div className="wizard-draft-banner" role="status">
          Recuperamos la documentación de tu práctica.
          {draftTrimmed
            ? " Algunos archivos se guardaron solo por nombre por límite de espacio."
            : null}
        </div>
      ) : null}

      <ol className="wizard-steps" aria-label="Pasos del asistente">
        {WIZARD_STEPS.map((s, index) => (
          <StepNavPopover
            key={s}
            variant="wizard"
            stepNumber={index + 1}
            label={WIZARD_STEP_LABELS[s]}
            summary={summarizeKrakenWizardStep(s, draft, mode, activeProject)}
            isActive={index === currentIndex}
            isDone={index < currentIndex}
            onSelect={() => setStep(s)}
          />
        ))}
      </ol>

      <section className="wizard-body">{renderStep()}</section>

      {visibleIssues.length > 0 ? (
        <ul className="wizard-errors builder-form__error-list" role="alert">
          {visibleIssues.map((issue) => (
            <li key={issue.field} className="builder-form__error">
              Pendiente: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="start-bar__blocked">{error}</p> : null}

      <div className="start-bar">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="start-bar__actions">
          {currentIndex > 0 ? (
            <Button variant="secondary" onClick={() => setStep(prevStep(step))}>
              Atrás
            </Button>
          ) : null}
          {isLast ? (
            <Button
              variant="primary"
              loading={submitting || isStarting}
              disabled={!canAdvance}
              onClick={() => void handleStart()}
            >
              Iniciar simulación
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canAdvance}
              onClick={() => setStep(nextStep(step))}
            >
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
