"use client";

import { useEffect, useId, useState } from "react";
import {
  citiesForSimulationCountry,
  SIMULATION_COUNTRIES,
} from "@/lib/kraken-lab/simulation-locations";
import {
  formatSimulationCitiesInput,
  parseSimulationCitiesInput,
  toggleSimulationCity,
} from "@/lib/kraken-lab/simulation-cities";

interface ParticipantSimulationCitiesFieldProps {
  country?: string;
  cities: string[];
  onChange: (next: { country?: string; cities: string[] }) => void;
}

export function ParticipantSimulationCitiesField({
  country,
  cities,
  onChange,
}: ParticipantSimulationCitiesFieldProps) {
  const countryId = useId();
  const citiesTextId = useId();
  const [textDraft, setTextDraft] = useState(() => formatSimulationCitiesInput(cities));
  const [isEditingText, setIsEditingText] = useState(false);
  const countryCities = citiesForSimulationCountry(country);

  useEffect(() => {
    if (!isEditingText) {
      setTextDraft(formatSimulationCitiesInput(cities));
    }
  }, [cities, isEditingText]);

  const commitTextDraft = () => {
    setIsEditingText(false);
    onChange({
      country,
      cities: parseSimulationCitiesInput(textDraft),
    });
  };

  return (
    <div className="participant-simulation-cities">
      <label className="field" htmlFor={countryId}>
        <span>País</span>
        <select
          id={countryId}
          value={country ?? ""}
          onChange={(event) => {
            const nextCountry = event.target.value || undefined;
            onChange({ country: nextCountry, cities });
          }}
        >
          <option value="">Selecciona un país</option>
          {SIMULATION_COUNTRIES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      {country && countryCities.length > 0 ? (
        <div className="participant-simulation-cities__picker">
          <p className="config-panel__hint">Ciudades en {country}</p>
          <div
            className="participant-simulation-cities__scroll wizard-chip-grid"
            role="listbox"
            aria-label={`Ciudades de ${country}`}
          >
            {countryCities.map((city) => {
              const selected = cities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`chip chip--toggle ${selected ? "chip--selected" : ""}`}
                  onClick={() => {
                    onChange({
                      country,
                      cities: toggleSimulationCity(cities, city),
                    });
                  }}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {cities.length > 0 ? (
        <div className="participant-simulation-cities__selected" aria-label="Ciudades seleccionadas">
          {cities.map((city) => (
            <span key={city} className="chip chip--custom">
              {city}
            </span>
          ))}
        </div>
      ) : null}

      <label className="field" htmlFor={citiesTextId}>
        <span>Ciudades de simulación (separadas por coma)</span>
        <input
          id={citiesTextId}
          value={textDraft}
          placeholder="Ej. Monterrey, Guadalajara"
          onFocus={() => setIsEditingText(true)}
          onChange={(event) => setTextDraft(event.target.value)}
          onBlur={commitTextDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTextDraft();
            }
          }}
        />
      </label>
    </div>
  );
}
