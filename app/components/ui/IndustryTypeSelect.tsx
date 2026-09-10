"use client";

import { useId, useMemo } from "react";
import {
  INDUSTRY_OPTIONS,
  OTHER_OPTION_VALUE,
  resolveSelectWithOtherValue,
} from "@/lib/scenarios/select-options";
import { SelectWithOtherCustomMode } from "@/app/components/ui/SelectWithOtherCustomMode";

export interface IndustryTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  otherPlaceholder?: string;
}

export function IndustryTypeSelect({
  value,
  onChange,
  otherPlaceholder = "Escribe tu valor…",
}: IndustryTypeSelectProps) {
  const selectId = useId();
  const inputId = useId();

  const { selectValue, customValue, showOtherInput } = useMemo(
    () => resolveSelectWithOtherValue(value, INDUSTRY_OPTIONS),
    [value],
  );

  const controlId = showOtherInput ? inputId : selectId;

  return (
    <div
      className={`field field--full industry-type-select select-with-other${
        showOtherInput ? " select-with-other--other-open" : ""
      }`}
    >
      <label className="field__label" htmlFor={controlId}>
        Tipo de empresa / industria
      </label>
      {showOtherInput ? (
        <SelectWithOtherCustomMode
          inputId={inputId}
          customValue={customValue}
          placeholder={otherPlaceholder}
          onChange={onChange}
          onBackToList={() => onChange("")}
        />
      ) : (
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
      )}
    </div>
  );
}
