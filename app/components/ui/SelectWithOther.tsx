"use client";

import { useId, useMemo, useState } from "react";
import { OTHER_OPTION_VALUE } from "@/lib/scenarios/select-options";

export interface SelectWithOtherProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  otherLabel?: string;
  placeholder?: string;
  otherPlaceholder?: string;
  required?: boolean;
}

export function SelectWithOther({
  label,
  value,
  options,
  onChange,
  otherLabel = "Otro",
  placeholder = "Selecciona una opción",
  otherPlaceholder = "Escribe tu valor",
  required = false,
}: SelectWithOtherProps) {
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
    if (options.includes(trimmed)) {
      return { selectValue: trimmed, customValue: "" };
    }
    return { selectValue: OTHER_OPTION_VALUE, customValue: trimmed };
  }, [options, otherActive, value]);

  const showOtherInput = selectValue === OTHER_OPTION_VALUE;

  return (
    <div className="field select-with-other">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="select-with-other__select"
        value={selectValue}
        required={required && !showOtherInput}
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
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_OPTION_VALUE}>{otherLabel}</option>
      </select>
      {showOtherInput ? (
        <input
          id={otherId}
          className="select-with-other__other"
          value={customValue}
          required={required}
          placeholder={otherPlaceholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
