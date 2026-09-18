"use client";

import { VoiceAgentControls } from "@/app/components/training/VoiceAgentControls";
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
          El modo automático ya está listo. Abre avanzado solo si quieres
          cambiar prompt, herramientas o visibilidad.
        </p>
      </header>

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

      <button
        type="button"
        className="agent-advanced-toggle"
        aria-expanded={settings.visibility.advancedOpen}
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
        <div className="agent-settings__advanced">
          <p className="agent-settings__hint">
            Camino feliz: Vercel AI Gateway → DeepSeek
            (AI_GATEWAY_API_KEY o VERCEL_OIDC_TOKEN).{" "}
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

          <VoiceAgentControls
            value={settings.voiceAgent}
            onChange={(voiceAgent) => onChange({ ...settings, voiceAgent })}
            showBargeIn
          />
        </div>
      ) : null}
    </section>
  );
}
