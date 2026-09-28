"use client";

import { useId, useMemo, useState } from "react";
import { autofillScenarioDraft, createScenario, updateScenario } from "@/lib/api/client";
import {
  difficultyEtiquetaOptions,
  normalizeDifficultyEtiqueta,
} from "@/lib/scenarios/difficulty-etiquette";
import {
  TEMPERAMENT_OTHER_VALUE,
  isListedTemperament,
  resolveTemperamentSelectValue,
  temperamentOptions,
} from "@/lib/scenarios/temperament-options";
import { SCORE_DIMENSIONS } from "@/lib/scoring/dimensions";
import {
  AUTHORING_STEPS,
  MAX_AUTHORED_BEATS,
  MIN_AUTHORED_BEATS,
  applyLanguageDefaults,
  callTypeLabel,
  defaultDimensionGuides,
  draftFromRecord,
  draftToCreateInput,
  emptyAuthoringDraft,
  languageLabel,
  nextAuthoringStep,
  previousAuthoringStep,
  validateAuthoringDraft,
  type AuthoringStep,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";
import type { ScenarioLanguage, ScenarioRecord, ScenarioRoundDef } from "@/lib/scenarios/types";
import type { ScoreDimensionId } from "@/lib/scoring/types";
import { Button } from "@/app/components/ui/Button";
import { CoachCallout } from "@/app/components/ui/CoachCallout";
import { SegmentedControl } from "@/app/components/ui/Switch";
import {
  AUTHORING_MENTAL_MODEL,
  difficultyCoachHint,
} from "@/lib/frontend/training-copy";

export interface ScenarioBuilderResult {
  scenario: ScenarioRecord;
}

interface ScenarioBuilderScreenProps {
  initialScenario?: ScenarioRecord | null;
  onSave: (result: ScenarioBuilderResult) => void;
  onCancel: () => void;
}

function stepLabel(step: AuthoringStep): string {
  switch (step) {
    case "persona":
      return "Perfil del comprador";
    case "beats":
      return "Briefing de fases";
    case "success":
      return "Cómo se gana";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

function stepHint(step: AuthoringStep): string {
  switch (step) {
    case "persona":
      return "Quién contesta el teléfono: rol, temperamento y dificultad.";
    case "beats":
      return "Arco de la llamada para el coach — no es lo que el comprador lee en voz alta.";
    case "success":
      return "Qué debe lograr el vendedor para ganar la práctica.";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

function newBeat(index: number): ScenarioRoundDef {
  return {
    key: `fase-${index + 1}`,
    label: `Fase ${index + 1}`,
    goal: "",
    clientPrompt: "",
    positiveCriteria: [],
    negativeCriteria: [],
    whatGoodLooksLike: "",
  };
}

export function ScenarioBuilderScreen({
  initialScenario = null,
  onSave,
  onCancel,
}: ScenarioBuilderScreenProps) {
  const editing = Boolean(initialScenario && !initialScenario.isPreset);
  const languageGroupId = useId();
  const callTypeGroupId = useId();
  const [step, setStep] = useState<AuthoringStep>("persona");
  const [draft, setDraft] = useState<ScenarioAuthoringDraft>(() =>
    initialScenario ? draftFromRecord(initialScenario) : emptyAuthoringDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [customTemperament, setCustomTemperament] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stepIndex = AUTHORING_STEPS.indexOf(step);
  const validationError = useMemo(() => validateAuthoringDraft(draft), [draft]);
  const canSave = validationError === null;

  const setField = <K extends keyof ScenarioAuthoringDraft>(
    field: K,
    value: ScenarioAuthoringDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleLanguageChange = (value: string) => {
    const language = value as ScenarioLanguage;
    setDraft((prev) => applyLanguageDefaults(prev, language));
  };

  const updateRound = (index: number, patch: Partial<ScenarioRoundDef>) => {
    setDraft((prev) => {
      const rounds = [...prev.rounds];
      rounds[index] = { ...rounds[index], ...patch };
      return { ...prev, rounds };
    });
  };

  const addRound = () => {
    setDraft((prev) => {
      if (prev.rounds.length >= MAX_AUTHORED_BEATS) return prev;
      return { ...prev, rounds: [...prev.rounds, newBeat(prev.rounds.length)] };
    });
  };

  const removeRound = (index: number) => {
    setDraft((prev) => {
      if (prev.rounds.length <= MIN_AUTHORED_BEATS) return prev;
      return { ...prev, rounds: prev.rounds.filter((_, i) => i !== index) };
    });
  };

  const temperamentSelectValue = resolveTemperamentSelectValue(
    draft.temperament,
    draft.language,
  );
  const showCustomTemperament =
    temperamentSelectValue === TEMPERAMENT_OTHER_VALUE;

  const handleAutofill = async () => {
    if (!draft.industry.trim() || !draft.clientProblem.trim()) {
      setError("Completa industria y problema del cliente antes del autofill.");
      return;
    }
    setAutofilling(true);
    setError(null);
    try {
      const { patch } = await autofillScenarioDraft(draft);
      setDraft((prev) => ({ ...prev, ...patch }));
      setStep("beats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo autocompletar.");
    } finally {
      setAutofilling(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToCreateInput(draft);
      const scenario =
        editing && initialScenario
          ? await updateScenario({ ...payload, slug: initialScenario.slug })
          : await createScenario(payload);
      onSave({ scenario });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="builder-screen"
      aria-label={editing ? "Editar escenario" : "Crear escenario"}
    >
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Capacitador · Diseño de escenario</p>
        <h1 className="page-hero__title">
          {editing ? "Afinar el perfil del comprador" : "Armar un caso de práctica"}
        </h1>
        <p className="page-hero__subtitle">
          Tres bloques: quién contesta, briefing de fases para el coach, y cómo
          gana el vendedor. La llamada en vivo usa este contexto — no copia tus
          textos palabra por palabra.
        </p>
      </header>

      <ol className="builder-steps" aria-label="Pasos del diseñador">
        {AUTHORING_STEPS.map((item, index) => {
          const state =
            item === step ? "current" : index < stepIndex ? "done" : "pending";
          return (
            <li
              key={item}
              className={`builder-steps__item builder-steps__item--${state}`}
            >
              <button
                type="button"
                className="builder-steps__button"
                aria-current={item === step ? "step" : undefined}
                onClick={() => setStep(item)}
              >
                <span className="builder-steps__index">{index + 1}</span>
                <span className="builder-steps__copy">
                  <strong>{stepLabel(item)}</strong>
                  <span>{stepHint(item)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="builder-form">
        <CoachCallout title={AUTHORING_MENTAL_MODEL.title}>
          {AUTHORING_MENTAL_MODEL.body}
        </CoachCallout>

        {step === "persona" ? (
          <fieldset className="builder-form__group">
            <legend>Perfil del comprador</legend>
            <p className="builder-form__note">
              Define a la persona que contesta el teléfono. El idioma del cliente
              se guarda para la simulación.
            </p>
            <div className="builder-subcard">
              <h3 className="builder-subcard__title">Identidad</h3>
            <div className="builder-form__grid">
              <div className="field field--full">
                <SegmentedControl
                  label="Idioma del cliente"
                  labelId={languageGroupId}
                  value={draft.language}
                  options={[
                    { value: "es", label: languageLabel("es") },
                    { value: "en", label: languageLabel("en") },
                  ]}
                  onChange={handleLanguageChange}
                />
              </div>
              <label className="field">
                <span className="field__label">Nombre</span>
                <input
                  value={draft.clientName}
                  onChange={(e) => setField("clientName", e.target.value)}
                  placeholder="Ej. Laura Méndez"
                />
              </label>
              <label className="field">
                <span className="field__label">Rol</span>
                <input
                  value={draft.clientTitle}
                  onChange={(e) => setField("clientTitle", e.target.value)}
                  placeholder="Ej. Gerente de sucursal"
                />
              </label>
              <label className="field field--full">
                <span className="field__label">Empresa / contexto</span>
                <input
                  value={draft.companyContext}
                  onChange={(e) => setField("companyContext", e.target.value)}
                  placeholder="Ej. Cadena nacional de gimnasios"
                />
              </label>
            </div>
            </div>
            <div className="builder-subcard">
              <h3 className="builder-subcard__title">Contexto de venta</h3>
              <div className="builder-form__grid">
              <label className="field">
                <span className="field__label">Industria / negocio</span>
                <input
                  value={draft.industry}
                  onChange={(e) => setField("industry", e.target.value)}
                  placeholder="Ej. sucursal bancaria, taller de llantas"
                />
              </label>
              <label className="field">
                <span className="field__label">¿Qué se vende?</span>
                <input
                  value={draft.productSold}
                  onChange={(e) => setField("productSold", e.target.value)}
                  placeholder="Ej. membresía premium, póliza de auto"
                />
              </label>
              <label className="field field--full">
                <span className="field__label">Problema real del cliente</span>
                <textarea
                  value={draft.clientProblem}
                  onChange={(e) => setField("clientProblem", e.target.value)}
                  placeholder="¿Qué le duele hoy? (briefing — no se lee en voz alta)"
                  rows={2}
                />
              </label>
              {draft.objections.map((obj, i) => (
                <label key={`obj-${i}`} className="field field--full">
                  <span className="field__label">Objeción esperada {i + 1}</span>
                  <input
                    value={obj}
                    onChange={(e) => {
                      const next = [...draft.objections];
                      next[i] = e.target.value;
                      setField("objections", next);
                    }}
                    placeholder="Ej. Ya tenemos proveedor"
                  />
                </label>
              ))}
              </div>
            </div>
            <div className="builder-subcard">
              <h3 className="builder-subcard__title">Psicología en la llamada</h3>
            <div className="builder-form__grid">
              <label className="field">
                <span className="field__label">Temperamento</span>
                <select
                  value={temperamentSelectValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === TEMPERAMENT_OTHER_VALUE) {
                      setField(
                        "temperament",
                        customTemperament.trim() || draft.temperament,
                      );
                      return;
                    }
                    setCustomTemperament("");
                    setField("temperament", value);
                  }}
                >
                  {temperamentOptions(draft.language).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={TEMPERAMENT_OTHER_VALUE}>Otro (escribir)</option>
                </select>
              </label>
              {showCustomTemperament ? (
                <label className="field">
                  <span className="field__label">Temperamento (otro)</span>
                  <input
                    value={
                      isListedTemperament(draft.temperament, draft.language)
                        ? customTemperament
                        : draft.temperament
                    }
                    onChange={(e) => {
                      setCustomTemperament(e.target.value);
                      setField("temperament", e.target.value);
                    }}
                    placeholder="Ej. Escéptico, directo"
                  />
                </label>
              ) : null}
              <label className="field">
                <span className="field__label">Dificultad (etiqueta)</span>
                <select
                  value={normalizeDifficultyEtiqueta(
                    draft.difficultyLabel,
                    draft.language,
                  )}
                  onChange={(e) => setField("difficultyLabel", e.target.value)}
                >
                  {difficultyEtiquetaOptions(draft.language).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field field--full builder-form__note builder-form__note--tight">
                {difficultyCoachHint(draft.difficultyLabel, draft.language)}
              </p>
            </div>
            </div>
          </fieldset>
        ) : null}

        {step === "beats" ? (
          <fieldset className="builder-form__group">
            <legend>Briefing de fases (coach)</legend>
            <p className="builder-form__note">
              De {MIN_AUTHORED_BEATS} a {MAX_AUTHORED_BEATS} momentos. Describe
              qué debe lograr el vendedor y qué presión pone el comprador — la IA
              improvisa el diálogo en vivo.
            </p>
            <div className="builder-autofill-card">
              <div className="builder-autofill-card__copy">
                <strong>Completar con IA</strong>
                <p>
                  Rellena fases, presiones y objeciones con criterio de piso de
                  ventas. Siempre puedes editar cada campo después.
                </p>
              </div>
              <Button
                variant="primary"
                loading={autofilling}
                onClick={() => void handleAutofill()}
              >
                Completar con IA
              </Button>
            </div>
            <ol className="builder-beats">
              {draft.rounds.map((round, index) => (
                <li key={round.key || `beat-${index}`} className="builder-beat">
                  <div className="builder-beat__head">
                    <h3>
                      Fase {index + 1}
                      {round.label ? ` · ${round.label}` : ""}
                    </h3>
                    {draft.rounds.length > MIN_AUTHORED_BEATS ? (
                      <Button
                        variant="ghost"
                        onClick={() => removeRound(index)}
                        aria-label={`Quitar fase ${index + 1}`}
                      >
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                  <div className="builder-form__grid">
                    <label className="field">
                      <span className="field__label">Nombre de la fase</span>
                      <input
                        value={round.label}
                        onChange={(e) =>
                          updateRound(index, { label: e.target.value })
                        }
                        placeholder="Ej. Apertura"
                      />
                    </label>
                    <label className="field field--full">
                      <span className="field__label">
                        Qué debe lograr el vendedor
                      </span>
                      <textarea
                        value={round.goal}
                        onChange={(e) =>
                          updateRound(index, { goal: e.target.value })
                        }
                        rows={2}
                        placeholder="Ej. Presentarse y enganchar con el problema real."
                      />
                    </label>
                    <label className="field field--full">
                      <span className="field__label">
                        Presión del cliente (coach, no diálogo)
                      </span>
                      <textarea
                        value={round.clientPrompt}
                        onChange={(e) =>
                          updateRound(index, { clientPrompt: e.target.value })
                        }
                        rows={2}
                        placeholder="Ej. Tengo poco tiempo. ¿A qué viene esto?"
                      />
                    </label>
                    <label className="field field--full">
                      <span className="field__label">
                        Qué se ve bien en esta fase
                      </span>
                      <textarea
                        value={round.whatGoodLooksLike ?? ""}
                        onChange={(e) =>
                          updateRound(index, {
                            whatGoodLooksLike: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="Ej. Pregunta abierta + reconoce el contexto, sin pitch."
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ol>
            {draft.rounds.length < MAX_AUTHORED_BEATS ? (
              <Button variant="secondary" onClick={addRound}>
                + Agregar fase
              </Button>
            ) : null}
          </fieldset>
        ) : null}

        {step === "success" ? (
          <fieldset className="builder-form__group">
            <legend>Cómo se gana la práctica</legend>
            <p className="builder-form__note">
              Define el «advance» concreto (día y hora cuando aplique). La
              puntuación usa la misma tarjeta de 6 puntos en cada llamada.
            </p>
            <div className="builder-form__grid">
              <div className="field field--full">
                <SegmentedControl
                  label="Tipo de llamada"
                  labelId={callTypeGroupId}
                  value={draft.callType}
                  options={[
                    { value: "fria", label: callTypeLabel("fria") },
                    { value: "discovery", label: callTypeLabel("discovery") },
                    { value: "cierre", label: callTypeLabel("cierre") },
                  ]}
                  onChange={(value) =>
                    setField("callType", value as ScenarioAuthoringDraft["callType"])
                  }
                />
              </div>
              <label className="field field--full">
                <span className="field__label">¿Qué cuenta como ganar?</span>
                <textarea
                  value={draft.winCriteria}
                  onChange={(e) => setField("winCriteria", e.target.value)}
                  rows={2}
                  placeholder="Ej. Cita con día y hora para una demo en sitio"
                />
              </label>
            </div>

            <details className="builder-scorecard" open>
              <summary className="builder-scorecard__summary">
                Afinar las 6 dimensiones (opcional)
              </summary>
              <header className="builder-scorecard__head">
                <p>
                  Pesos fijos: apertura 15%, discovery 25%, dolor 20%, valor 15%,
                  objeción 10%, cierre 15%.
                </p>
              </header>
              <ol className="builder-scorecard__list">
                {SCORE_DIMENSIONS.map((dim) => (
                  <li key={dim.id} className="builder-scorecard__item">
                    <label className="field">
                      <span className="field__label">
                        {dim.label}{" "}
                        <span className="builder-scorecard__weight">
                          {Math.round(dim.baseWeight * 100)}%
                        </span>
                      </span>
                      <textarea
                        value={draft.dimensionGuides[dim.id] ?? ""}
                        onChange={(e) =>
                          setField("dimensionGuides", {
                            ...draft.dimensionGuides,
                            [dim.id as ScoreDimensionId]: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder={defaultDimensionGuides(draft.language)[dim.id]}
                      />
                    </label>
                  </li>
                ))}
              </ol>
            </details>
          </fieldset>
        ) : null}

        {error ? (
          <p className="builder-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="builder-form__actions">
          {step !== "persona" ? (
            <Button
              variant="ghost"
              onClick={() => setStep(previousAuthoringStep(step))}
            >
              Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={onCancel}>
              Volver
            </Button>
          )}
          {step !== "success" ? (
            <Button
              variant="primary"
              onClick={() => setStep(nextAuthoringStep(step))}
            >
              Continuar
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canSave}
              loading={saving}
              onClick={() => void handleSave()}
            >
              {editing ? "Guardar cambios" : "Guardar escenario"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
