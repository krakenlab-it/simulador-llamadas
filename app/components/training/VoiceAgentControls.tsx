"use client";

import { useId } from "react";
import { Button } from "@/app/components/ui/Button";
import { SegmentedControl, Switch } from "@/app/components/ui/Switch";
import {
  CLIENT_TONE_IDS,
  CLIENT_TONE_LABELS,
  DEFAULT_CLIENT_LAYER_SETTINGS,
  type ClientToneId,
} from "@/lib/agent/client-layer";
import {
  PREMADE_VOICES,
  type AgentLanguage,
  type AgentPersonality,
  type SpeakingRatePreset,
  type VoiceAgentSettings,
  type VoiceGenderPreference,
} from "@/lib/voice/agent-settings";
import { ELEVENLABS_CONNECTION_ENV_NAMES } from "@/lib/voice/voice-pool";

interface VoiceAgentControlsProps {
  value: VoiceAgentSettings;
  onChange: (next: VoiceAgentSettings) => void;
  showBargeIn: boolean;
}

const LANGUAGE_OPTIONS: { value: AgentLanguage; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const GENDER_OPTIONS: { value: VoiceGenderPreference; label: string }[] = [
  { value: "auto", label: "Según personaje" },
  { value: "female", label: "Mujer" },
  { value: "male", label: "Hombre" },
];

const TONE_OPTIONS: { value: ClientToneId; label: string }[] = CLIENT_TONE_IDS.map(
  (toneId) => ({
    value: toneId,
    label: CLIENT_TONE_LABELS[toneId],
  }),
);

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
  const genderId = useId();
  const toneId = useId();
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
        <SegmentedControl
          label="Género de voz"
          labelId={genderId}
          value={value.voiceGender}
          options={GENDER_OPTIONS}
          onChange={(voiceGender) =>
            onChange({
              ...value,
              voiceGender,
              voiceOverride: false,
              voiceId: "",
            })
          }
        />
        <Switch
          label="Cliente en vivo"
          description="El caso arma el pack. El cliente responde; el coach va aparte."
          checked={(value.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS).motorEnabled}
          onCheckedChange={(motorEnabled) =>
            onChange({
              ...value,
              clientLayer: {
                ...(value.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS),
                motorEnabled,
              },
            })
          }
        />
        <SegmentedControl
          label="Tono del cliente"
          labelId={toneId}
          value={(value.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS).toneId}
          options={TONE_OPTIONS}
          onChange={(nextTone) =>
            onChange({
              ...value,
              clientLayer: {
                ...(value.clientLayer ?? DEFAULT_CLIENT_LAYER_SETTINGS),
                toneId: nextTone,
              },
            })
          }
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
              value={value.voiceOverride ? value.voiceId : ""}
              onChange={(event) => {
                const nextId = event.target.value;
                onChange({
                  ...value,
                  voiceId: nextId,
                  voiceOverride: Boolean(nextId),
                });
              }}
            >
              <option value="">Según el personaje (2 voces por género)</option>
              {PREMADE_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} · {voice.gender === "male" ? "hombre" : voice.gender === "female" ? "mujer" : "neutra"}
                </option>
              ))}
            </select>
          </div>

          <p className="agent-settings__hint" aria-label="Conexión ElevenLabs">
            ElevenLabs (nombres de variables, nunca valores):{" "}
            {ELEVENLABS_CONNECTION_ENV_NAMES.join(", ")}. El servidor elige
            voz mujer/hombre del pool. Español nativo (LATAM); English aparte.
          </p>

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
