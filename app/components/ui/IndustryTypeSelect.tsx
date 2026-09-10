"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import {
  INDUSTRY_OPTIONS,
  OTHER_OPTION_VALUE,
  resolveSelectWithOtherValue,
} from "@/lib/scenarios/select-options";

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
  const otherInputRef = useRef<HTMLInputElement>(null);
  const prevShowOtherRef = useRef(false);

  const { selectValue, customValue, showOtherInput } = useMemo(
    () => resolveSelectWithOtherValue(value, INDUSTRY_OPTIONS),
    [value],
  );

  useEffect(() => {
    if (showOtherInput && !prevShowOtherRef.current) {
      otherInputRef.current?.focus();
    }
    prevShowOtherRef.current = showOtherInput;
  }, [showOtherInput]);

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
            onChange(OTHER_OPTION_VALUE);
            return;
          }
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
        <>
          <label className="field__label" htmlFor={otherId}>
            Escribe tu valor
          </label>
          <input
            ref={otherInputRef}
            id={otherId}
            className="industry-type-select__other"
            value={customValue}
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
