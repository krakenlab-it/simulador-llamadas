import type { InputHTMLAttributes } from "react";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  id,
  disabled,
  ...props
}: SwitchProps) {
  const inputId = id ?? `switch-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label
      className={`switch ${disabled ? "switch--disabled" : ""}`}
      htmlFor={inputId}
    >
      <span className="switch__copy">
        <span className="switch__label">{label}</span>
        {description ? (
          <span className="switch__desc">{description}</span>
        ) : null}
      </span>
      <span className="switch__track" aria-hidden="true">
        <input
          type="checkbox"
          role="switch"
          id={inputId}
          className="switch__input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          {...props}
        />
        <span className="switch__thumb" />
      </span>
    </label>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  labelId: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  labelId,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented-field">
      <span className="segmented-field__label" id={labelId}>
        {label}
      </span>
      <div
        className="segmented"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            className={`segmented__item ${value === opt.value ? "segmented__item--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
