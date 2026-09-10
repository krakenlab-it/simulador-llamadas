"use client";

import { useEffect, useRef, type RefObject } from "react";
import { OTHER_OPTION_VALUE } from "@/lib/scenarios/select-options";

export interface SelectWithOtherCustomModeProps {
  inputId: string;
  customValue: string;
  placeholder: string;
  required?: boolean;
  onChange: (value: string) => void;
  onBackToList: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function SelectWithOtherCustomMode({
  inputId,
  customValue,
  placeholder,
  required = false,
  onChange,
  onBackToList,
  inputRef,
}: SelectWithOtherCustomModeProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? localRef;

  useEffect(() => {
    resolvedRef.current?.focus();
  }, [resolvedRef]);

  return (
    <div className="select-with-other__custom-mode">
      <input
        ref={resolvedRef}
        id={inputId}
        type="text"
        className="select-with-other__custom-input"
        value={customValue}
        required={required}
        placeholder={placeholder}
        autoFocus
        data-testid="select-with-other-input"
        aria-label={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? OTHER_OPTION_VALUE : next);
        }}
      />
      <p className="select-with-other__hint">Modo personalizado: escribe aquí.</p>
      <button
        type="button"
        className="select-with-other__back"
        onClick={onBackToList}
      >
        Elegir de la lista
      </button>
    </div>
  );
}
