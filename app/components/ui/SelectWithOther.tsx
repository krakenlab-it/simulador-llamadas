"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import {
  OTHER_OPTION_VALUE,
  resolveSelectWithOtherValue,
} from "@/lib/scenarios/select-options";

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
  const otherInputRef = useRef<HTMLInputElement>(null);
  const prevShowOtherRef = useRef(false);

  const { selectValue, customValue, showOtherInput } = useMemo(
    () => resolveSelectWithOtherValue(value, options),
    [options, value],
  );

  useEffect(() => {
    if (showOtherInput && !prevShowOtherRef.current) {
      otherInputRef.current?.focus();
    }
    prevShowOtherRef.current = showOtherInput;
  }, [showOtherInput]);

  return (
    <div
      className={`field select-with-other${showOtherInput ? " field--full" : ""}`}
    >
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
            onChange(OTHER_OPTION_VALUE);
            return;
          }
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
        <>
          <label className="field__label" htmlFor={otherId}>
            Escribe tu valor
          </label>
          <input
            ref={otherInputRef}
            id={otherId}
            className="select-with-other__other"
            value={customValue}
            required={required}
            placeholder={otherPlaceholder}
            onChange={(event) => {
              const next = event.target.value;
              onChange(next === "" ? OTHER_OPTION_VALUE : next);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
