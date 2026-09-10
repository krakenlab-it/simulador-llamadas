"use client";

import { useId, useMemo } from "react";
import {
  OTHER_OPTION_VALUE,
  resolveSelectWithOtherValue,
} from "@/lib/scenarios/select-options";
import { SelectWithOtherCustomMode } from "@/app/components/ui/SelectWithOtherCustomMode";

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
  otherPlaceholder = "Escribe tu valor…",
  required = false,
}: SelectWithOtherProps) {
  const selectId = useId();
  const inputId = useId();

  const { selectValue, customValue, showOtherInput } = useMemo(
    () => resolveSelectWithOtherValue(value, options),
    [options, value],
  );

  const controlId = showOtherInput ? inputId : selectId;

  return (
    <div
      className={`field field--full select-with-other${
        showOtherInput ? " select-with-other--other-open" : ""
      }`}
    >
      <label className="field__label" htmlFor={controlId}>
        {label}
      </label>
      {showOtherInput ? (
        <SelectWithOtherCustomMode
          inputId={inputId}
          customValue={customValue}
          placeholder={otherPlaceholder}
          required={required}
          onChange={onChange}
          onBackToList={() => onChange("")}
        />
      ) : (
        <select
          id={selectId}
          className="select-with-other__select"
          value={selectValue}
          required={required}
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
      )}
    </div>
  );
}
