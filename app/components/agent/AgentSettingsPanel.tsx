"use client";

import { useId } from "react";
import { VoiceAgentControls } from "@/app/components/training/VoiceAgentControls";
import { Button } from "@/app/components/ui/Button";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";
import { AGENT_PRESETS } from "@/lib/agent/presets";
import {
  applyPreset,
  applySystemPrompt,
  parseAgentHarnessSettings,
} from "@/lib/agent/settings";
import { AGENT_TOOL_CATALOG } from "@/lib/agent/tools";
import type {
  AgentHarnessSettings,
  AgentPresetId,
  AgentProviderPreference,
  AgentRuntimeMode,
  AgentToolId,
} from "@/lib/agent/types";
import {
  callTypeLabel,
  languageLabel,
} from "@/lib/scenarios/authoring";
import type { ScenarioCallType, ScenarioLanguage } from "@/lib/scenarios/types";

interface AgentSettingsPanelProps {
  value: AgentHarnessSettings;
  onChange: (next: AgentHarnessSettings) => void;
  availability: { groq: boolean; gemini: boolean; gateway: boolean };
}

const RUNTIME_OPTIONS: { value: AgentRuntimeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "ai-sdk", label: "AI SDK" },
  { value: "local", label: "Local" },
];

const PROVIDER_OPTIONS: { value: AgentProviderPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "groq", label: "Groq" },
  { value: "gemini", label: "Gemini" },
];

const LANGUAGE_OPTIONS: { value: ScenarioLanguage; label: string }[] = [
  { value: "es", label: languageLabel("es") },
  { value: "en", label: languageLabel("en") },
];

const CALL_TYPE_OPTIONS: { value: ScenarioCallType; label: string }[] = [
  { value: "fria", label: callTypeLabel("fria") },
  { value: "discovery", label: callTypeLabel("discovery") },
  { value: "cierre", label: callTypeLabel("cierre") },
];

export function AgentSettingsPanel({
  value,
  onChange,
  availability,
}: AgentSettingsPanelProps) {
  const runtimeId = useId();
  const providerId = useId();
  const languageId = useId();
  const callTypeId = useId();
  const promptId = useId();
  const temperatureId = useId();
  const stepsId = useId();
  const advancedId = useId();

  const commit = (partial: Partial<AgentHarnessSettings>) => {
    onChange(parseAgentHarnessSettings({ ...value, ...partial }));
  };

  const hasModel = availability.groq || availability.gemini || availability.gateway;

  return (
    <aside className="agent-settings" aria-label="Ajustes del agente">
      <header className="agent-settings__head">
        <h2 className="agent-settings__title">Ajustes del agente</h2>
        <p className="agent-settings__lede">
          Aquí vive toda la configuración. El preset y el system prompt bastan
          para el primer caso.
        </p>
      </header>

      <div className="agent-settings__presets" role="group" aria-label="Presets">
        {AGENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`agent-preset ${value.presetId === preset.id ? "agent-preset--active" : ""}`}
            onClick={() => onChange(applyPreset(value, preset.id))}
          >
            <span className="agent-preset__label">{preset.label}</span>
            <span className="agent-preset__desc">{preset.description}</span>
          </button>
        ))}
        <button
          type="button"
          className={`agent-preset ${value.presetId === "custom" ? "agent-preset--active" : ""}`}
          onClick={() => onChange(applyPreset(value, "custom" satisfies AgentPresetId))}
        >
          <span className="agent-preset__label">Personalizado</span>
          <span className="agent-preset__desc">
            Conserva el prompt que estás editando.
          </span>
        </button>
      </div>

      <div className="agent-settings__section">
        <label className="config-panel__label" htmlFor={promptId}>
          System prompt
        </label>
        <textarea
          id={promptId}
          className="agent-prompt"
          rows={10}
          value={value.systemPrompt}
          onChange={(event) =>
            onChange(applySystemPrompt(value, event.target.value))
          }
        />
        <p className="config-panel__hint">
          Edítalo para probar otro ángulo. Restaurar un preset lo reemplaza.
        </p>
      </div>

      <Button
        variant="ghost"
        aria-expanded={value.visibility.advancedOpen}
        aria-controls={advancedId}
        onClick={() =>
          commit({
            visibility: {
              ...value.visibility,
              advancedOpen: !value.visibility.advancedOpen,
            },
          })
        }
      >
        {value.visibility.advancedOpen
          ? "Ocultar ajustes avanzados"
          : "Mostrar todos los ajustes"}
      </Button>

      {value.visibility.advancedOpen ? (
        <div className="agent-settings__advanced" id={advancedId}>
          <SegmentedControl
            label="Runtime"
            labelId={runtimeId}
            value={value.runtime}
            options={RUNTIME_OPTIONS}
            onChange={(runtime) => commit({ runtime })}
          />
          <p className="config-panel__hint">
            {hasModel
              ? "Auto usa el Vercel AI SDK. Si el modelo falla, el fallback local no rompe el flujo."
              : "Sin GROQ_API_KEY / GOOGLE_API_KEY el runtime Auto usa el fallback local y el caso igual se arma."}
          </p>

          <SegmentedControl
            label="Proveedor"
            labelId={providerId}
            value={value.providerPreference}
            options={PROVIDER_OPTIONS}
            onChange={(providerPreference) => commit({ providerPreference })}
          />

          <div className="agent-settings__pair">
            <label className="config-panel__label" htmlFor={temperatureId}>
              Temperatura ({value.temperature.toFixed(2)})
            </label>
            <input
              id={temperatureId}
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={value.temperature}
              onChange={(event) =>
                commit({ temperature: Number(event.target.value) })
              }
            />
          </div>

          <div className="agent-settings__pair">
            <label className="config-panel__label" htmlFor={stepsId}>
              Pasos máximos de herramientas
            </label>
            <input
              id={stepsId}
              className="config-panel__select"
              type="number"
              min={1}
              max={8}
              value={value.maxSteps}
              onChange={(event) =>
                commit({ maxSteps: Number(event.target.value) })
              }
            />
          </div>

          <SegmentedControl
            label="Idioma del caso"
            labelId={languageId}
            value={value.language}
            options={LANGUAGE_OPTIONS}
            onChange={(language) => commit({ language })}
          />

          <SegmentedControl
            label="Tipo de llamada"
            labelId={callTypeId}
            value={value.callType}
            options={CALL_TYPE_OPTIONS}
            onChange={(callType) => commit({ callType })}
          />

          <fieldset className="agent-settings__fieldset">
            <legend className="config-panel__label">Herramientas</legend>
            {AGENT_TOOL_CATALOG.map((tool) => (
              <Switch
                key={tool.id}
                label={tool.label}
                description={tool.description}
                checked={value.enabledTools.includes(tool.id)}
                onCheckedChange={(checked) => {
                  const next = new Set<AgentToolId>(value.enabledTools);
                  if (checked) next.add(tool.id);
                  else next.delete(tool.id);
                  commit({ enabledTools: [...next] });
                }}
              />
            ))}
          </fieldset>

          <fieldset className="agent-settings__fieldset">
            <legend className="config-panel__label">Contexto que recibe el agente</legend>
            <Switch
              label="Catálogo de escenarios"
              checked={value.includeCatalog}
              onCheckedChange={(includeCatalog) => commit({ includeCatalog })}
            />
            <Switch
              label="Borrador actual"
              checked={value.includeDraft}
              onCheckedChange={(includeDraft) => commit({ includeDraft })}
            />
            <Switch
              label="Ajustes de voz"
              checked={value.includeVoiceSettings}
              onCheckedChange={(includeVoiceSettings) =>
                commit({ includeVoiceSettings })
              }
            />
          </fieldset>

          <fieldset className="agent-settings__fieldset">
            <legend className="config-panel__label">Visibilidad (no rompe el flujo)</legend>
            <Switch
              label="Mostrar system prompt"
              checked={value.visibility.showSystemPrompt}
              onCheckedChange={(showSystemPrompt) =>
                commit({
                  visibility: { ...value.visibility, showSystemPrompt },
                })
              }
            />
            <Switch
              label="Mostrar herramientas"
              checked={value.visibility.showTools}
              onCheckedChange={(showTools) =>
                commit({ visibility: { ...value.visibility, showTools } })
              }
            />
            <Switch
              label="Mostrar contexto empaquetado"
              checked={value.visibility.showContext}
              onCheckedChange={(showContext) =>
                commit({ visibility: { ...value.visibility, showContext } })
              }
            />
            <Switch
              label="Mostrar trazas de tools"
              checked={value.visibility.showTraces}
              onCheckedChange={(showTraces) =>
                commit({ visibility: { ...value.visibility, showTraces } })
              }
            />
          </fieldset>

          <VoiceAgentControls
            value={value.voiceAgent}
            onChange={(voiceAgent) =>
              commit({
                voiceAgent,
                language: voiceAgent.language,
                difficultyLevel: voiceAgent.difficultyLevel,
              })
            }
            showBargeIn
          />
        </div>
      ) : null}
    </aside>
  );
}
