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
    <div
      className={`field field--full industry-type-select${
        showOtherInput ? " select-with-other--other-open" : ""
      }`}
    >
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
        <div className="select-with-other__other-block">
          <p className="select-with-other__hint">
            Puedes tipar tu opción personalizada.
          </p>
          <label className="field__label" htmlFor={otherId}>
            Escribe tu valor
          </label>
          <input
            ref={otherInputRef}
            id={otherId}
            className="industry-type-select__other select-with-other__other"
            value={customValue}
            placeholder={otherPlaceholder}
            autoFocus
            data-testid="select-with-other-input"
            onChange={(event) => {
              const next = event.target.value;
              onChange(next === "" ? OTHER_OPTION_VALUE : next);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
