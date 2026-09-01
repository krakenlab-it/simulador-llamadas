"use client";

import type { CSSProperties } from "react";

interface SegmentedSwitchOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedSwitchProps<T extends string | number> {
  id: string;
  label: string;
  options: SegmentedSwitchOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedSwitch<T extends string | number>({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
}: SegmentedSwitchProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div className="segmented-switch" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="segmented-switch-heading">
        {label}
      </span>
      <div
        className={`segmented-switch-track ${disabled ? "disabled" : ""}`}
        style={
          {
            "--segment-count": options.length,
            "--segment-index": activeIndex < 0 ? 0 : activeIndex,
          } as CSSProperties
        }
      >
        <span className="segmented-switch-thumb" aria-hidden="true" />
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              className={`segmented-switch-option ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
