"use client";

import { VoiceAgentControls } from "@/app/components/training/VoiceAgentControls";
import {
  CLIENT_LAYER_ENGINES,
  DEFAULT_CLIENT_LAYER_SETTINGS,
} from "@/lib/agent/client-layer";
import { describeClientLayerForTrainer } from "@/lib/agent/client-pack";
import { AGENT_PRESETS } from "@/lib/agent/presets";
import { applyPreset, applySystemPrompt } from "@/lib/agent/settings";
import { AGENT_TOOL_CATALOG } from "@/lib/agent/tools";
import type {
  AgentHarnessSettings,
  AgentPresetId,
  AgentProviderAvailability,
  AgentProviderPreference,
  AgentRuntimeMode,
  AgentToolId,
} from "@/lib/agent/types";

interface AgentSettingsPanelProps {
  settings: AgentHarnessSettings;
  availability: AgentProviderAvailability | null;
  onChange: (next: AgentHarnessSettings) => void;
}

const RUNTIME_OPTIONS: Array<{ id: AgentRuntimeMode; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "ai-sdk", label: "AI SDK" },
  { id: "local", label: "Local" },
];

const PROVIDER_OPTIONS: Array<{ id: AgentProviderPreference; label: string }> = [
  { id: "auto", label: "Auto (Gateway → DeepSeek)" },
  { id: "deepseek", label: "DeepSeek (vía Gateway)" },
  { id: "groq", label: "Groq" },
  { id: "gemini", label: "Gemini" },
];

export function AgentSettingsPanel({
  settings,
  availability,
  onChange,
}: AgentSettingsPanelProps) {
  const toggleTool = (id: AgentToolId) => {
    const enabled = settings.enabledTools.includes(id)
      ? settings.enabledTools.filter((item) => item !== id)
      : [...settings.enabledTools, id];
    onChange({ ...settings, enabledTools: enabled });
  };

  return (
    <section className="agent-settings" aria-label="Ajustes del agente">
      <header className="agent-settings__head">
        <h2>Ajustes del agente</h2>
        <p>
          El caso arma el pack (hechos, objeción real, qué concede). Tú solo
          eliges tono, idioma y si el cliente vive. El coach no habla con esa
          voz. Avanzado es prompt y herramientas.
        </p>
      </header>

      <div className="client-engines" role="list" aria-label="Capas del cliente">
        {CLIENT_LAYER_ENGINES.map((engine) => (
          <article key={engine.id} className="client-engines__card" role="listitem">
            <h3>{engine.title}</h3>
            <p>{engine.body}</p>
          </article>
        ))}
      </div>

      <p className="agent-settings__hint">
        {describeClientLayerForTrainer(
          settings.voiceAgent.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS,
        )}
      </p>

      <VoiceAgentControls
        value={settings.voiceAgent}
        onChange={(voiceAgent) => onChange({ ...settings, voiceAgent })}
        showBargeIn
      />

      <div className="agent-preset-row" role="group" aria-label="Presets">
        {([...Object.values(AGENT_PRESETS), { id: "custom" as const, label: "Personalizado", prompt: settings.systemPrompt }]).map(
          (preset) => (
            <button
              key={preset.id}
              type="button"
              className={`agent-preset ${settings.presetId === preset.id ? "agent-preset--active" : ""}`}
              onClick={() =>
                onChange(applyPreset(settings, preset.id as AgentPresetId))
              }
            >
              {preset.label}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className="agent-advanced-toggle"
        aria-expanded={settings.visibility.advancedOpen}
        aria-controls="agent-settings-advanced"
        onClick={() =>
          onChange({
            ...settings,
            visibility: {
              ...settings.visibility,
              advancedOpen: !settings.visibility.advancedOpen,
            },
          })
        }
      >
        {settings.visibility.advancedOpen
          ? "Ocultar ajustes avanzados"
          : "Mostrar todos los ajustes"}
      </button>

      {settings.visibility.advancedOpen ? (
        <div id="agent-settings-advanced" className="agent-settings__advanced">
          <label className="agent-field">
            <span>System prompt (canal agente)</span>
            <textarea
              rows={10}
              value={settings.systemPrompt}
              onChange={(event) =>
                onChange(applySystemPrompt(settings, event.target.value))
              }
            />
          </label>
          <p className="agent-settings__hint">
            Camino feliz: Vercel AI Gateway → DeepSeek
            (AI_GATEWAY_API_KEY o VERCEL_OIDC_TOKEN). Voz: género del
            personaje → pool ElevenLabs (2 mujeres / 2 hombres).{" "}
            {availability?.gateway
              ? "Gateway disponible en el servidor."
              : availability?.hasModel
                ? "Sin Gateway: hay un fallback (Groq, Gemini o DeepSeek directo)."
                : "Sin Gateway: el backend usa el modo local (sin gasto)."}
          </p>

          <fieldset className="agent-fieldset">
            <legend>Runtime</legend>
            {RUNTIME_OPTIONS.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name="agent-runtime"
                  checked={settings.runtime === option.id}
                  onChange={() =>
                    onChange({ ...settings, runtime: option.id })
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="agent-fieldset">
            <legend>Proveedor</legend>
            {PROVIDER_OPTIONS.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name="agent-provider"
                  checked={settings.providerPreference === option.id}
                  onChange={() =>
                    onChange({ ...settings, providerPreference: option.id })
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <label className="agent-field">
            <span>Temperatura ({settings.temperature})</span>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.1}
              value={settings.temperature}
              onChange={(event) =>
                onChange({
                  ...settings,
                  temperature: Number(event.target.value),
                })
              }
            />
          </label>

          <label className="agent-field">
            <span>Pasos máximos de herramientas</span>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.maxSteps}
              onChange={(event) =>
                onChange({
                  ...settings,
                  maxSteps: Number(event.target.value),
                })
              }
            />
          </label>

          <fieldset className="agent-fieldset">
            <legend>Herramientas</legend>
            {AGENT_TOOL_CATALOG.map((tool) => (
              <label key={tool.id}>
                <input
                  type="checkbox"
                  checked={settings.enabledTools.includes(tool.id)}
                  onChange={() => toggleTool(tool.id)}
                />
                {tool.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="agent-fieldset">
            <legend>Contexto empaquetado</legend>
            <label>
              <input
                type="checkbox"
                checked={settings.includeCatalog}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    includeCatalog: event.target.checked,
                  })
                }
              />
              Catálogo
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.includeDraft}
                onChange={(event) =>
                  onChange({ ...settings, includeDraft: event.target.checked })
                }
              />
              Borrador
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.includeVoiceSettings}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    includeVoiceSettings: event.target.checked,
                  })
                }
              />
              Voz
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.includeTeams}
                onChange={(event) =>
                  onChange({ ...settings, includeTeams: event.target.checked })
                }
              />
              Equipos
            </label>
          </fieldset>

          <fieldset className="agent-fieldset">
            <legend>Visibilidad</legend>
            <label>
              <input
                type="checkbox"
                checked={settings.visibility.showTools}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    visibility: {
                      ...settings.visibility,
                      showTools: event.target.checked,
                    },
                  })
                }
              />
              Herramientas
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.visibility.showContext}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    visibility: {
                      ...settings.visibility,
                      showContext: event.target.checked,
                    },
                  })
                }
              />
              Contexto
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.visibility.showTraces}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    visibility: {
                      ...settings.visibility,
                      showTraces: event.target.checked,
                    },
                  })
                }
              />
              Trazas
            </label>
          </fieldset>
        </div>
      ) : null}
    </section>
  );
}
