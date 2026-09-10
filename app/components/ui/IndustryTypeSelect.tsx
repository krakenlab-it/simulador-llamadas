"use client";

import { useId, useMemo, useState } from "react";
import { INDUSTRY_OPTIONS, OTHER_OPTION_VALUE } from "@/lib/scenarios/select-options";

export interface IndustryTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  otherPlaceholder?: string;
}

export function IndustryTypeSelect({
  value,
  onChange,
  otherPlaceholder = "Ej. taller de llantas, sucursal bancaria",
}: IndustryTypeSelectProps) {
  const selectId = useId();
  const otherId = useId();
  const [otherActive, setOtherActive] = useState(false);

  const { selectValue, customValue } = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        selectValue: otherActive ? OTHER_OPTION_VALUE : "",
        customValue: "",
      };
    }
    if ((INDUSTRY_OPTIONS as readonly string[]).includes(trimmed)) {
      return { selectValue: trimmed, customValue: "" };
    }
    return { selectValue: OTHER_OPTION_VALUE, customValue: trimmed };
  }, [otherActive, value]);

  const showOtherInput = selectValue === OTHER_OPTION_VALUE;

  return (
    <div className="field field--full industry-type-select">
      <label className="field__label" htmlFor={selectId}>
        Tipo de empresa / industria
      </label>
      <select
        id={selectId}
        className="industry-type-select__select"
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER_OPTION_VALUE) {
            setOtherActive(true);
            onChange(customValue || "");
            return;
          }
          setOtherActive(false);
          onChange(next);
        }}
      >
        <option value="">Selecciona el tipo de empresa</option>
        {INDUSTRY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_OPTION_VALUE}>Otro</option>
      </select>
      {showOtherInput ? (
        <input
          id={otherId}
          className="industry-type-select__other"
          value={customValue}
          placeholder={otherPlaceholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
