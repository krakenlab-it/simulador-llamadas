"use client";

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ id, checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={`switch ${disabled ? "disabled" : ""}`} htmlFor={id}>
      <span className="switch-label">{label}</span>
      <span className="switch-track" aria-hidden="true">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="switch-input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="switch-thumb" />
      </span>
    </label>
  );
}
