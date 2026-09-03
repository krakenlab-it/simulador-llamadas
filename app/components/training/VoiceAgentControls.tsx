"use client";

import { useId } from "react";
import { Button } from "@/app/components/ui/Button";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";
import {
  PREMADE_VOICES,
  type AgentLanguage,
  type AgentPersonality,
  type SpeakingRatePreset,
  type VoiceAgentSettings,
} from "@/lib/voice/agent-settings";

interface VoiceAgentControlsProps {
  value: VoiceAgentSettings;
  onChange: (next: VoiceAgentSettings) => void;
  showBargeIn: boolean;
}

const LANGUAGE_OPTIONS: { value: AgentLanguage; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const RATE_OPTIONS: { value: SpeakingRatePreset; label: string }[] = [
  { value: "lento", label: "Lento" },
  { value: "normal", label: "Normal" },
  { value: "rapido", label: "Rápido" },
];

const PERSONALITY_OPTIONS: { value: AgentPersonality; label: string }[] = [
  { value: "paciente", label: "Paciente" },
  { value: "neutral", label: "Neutral" },
  { value: "esceptico", label: "Escéptico" },
  { value: "impaciente", label: "Impaciente" },
];

export function VoiceAgentControls({
  value,
  onChange,
  showBargeIn,
}: VoiceAgentControlsProps) {
  const languageId = useId();
  const rateId = useId();
  const personalityId = useId();
  const voiceId = useId();
  const advancedId = useId();

  return (
    <div className="voice-controls">
      <div className="voice-controls__essentials">
        <SegmentedControl
          label="Idioma"
          labelId={languageId}
          value={value.language}
          options={LANGUAGE_OPTIONS}
          onChange={(language) => onChange({ ...value, language })}
        />
        <Button
          variant="ghost"
          aria-expanded={value.advancedOpen}
          aria-controls={advancedId}
          onClick={() => onChange({ ...value, advancedOpen: !value.advancedOpen })}
        >
          Avanzado
        </Button>
      </div>

      {value.advancedOpen ? (
        <div className="voice-controls__advanced" id={advancedId}>
          <div className="config-panel__section">
            <label className="config-panel__label" htmlFor={voiceId}>
              Voz
            </label>
            <select
              id={voiceId}
              className="config-panel__select"
              value={value.voiceId}
              onChange={(event) =>
                onChange({ ...value, voiceId: event.target.value })
              }
            >
              {PREMADE_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-panel__section">
            <SegmentedControl
              label="Ritmo"
              labelId={rateId}
              value={value.speakingRate}
              options={RATE_OPTIONS}
              onChange={(speakingRate) => onChange({ ...value, speakingRate })}
            />
          </div>

          <div className="config-panel__section">
            <SegmentedControl
              label="Personalidad"
              labelId={personalityId}
              value={value.personality}
              options={PERSONALITY_OPTIONS}
              onChange={(personality) => onChange({ ...value, personality })}
            />
          </div>

          {showBargeIn ? (
            <div className="config-panel__section">
              <Switch
                label="Interrumpir"
                description="Corta al cliente si empiezas a hablar"
                checked={value.bargeIn}
                onCheckedChange={(bargeIn) => onChange({ ...value, bargeIn })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
