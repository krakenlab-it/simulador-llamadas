"use client";

import { useId, useState } from "react";

interface AuthPasswordFieldProps {
  id?: string;
  name: string;
  label: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  minLength?: number;
  onChange: (value: string) => void;
}

export function AuthPasswordField({
  id,
  name,
  label,
  value,
  autoComplete,
  disabled = false,
  minLength = 6,
  onChange,
}: AuthPasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={fieldId}
          className="auth-input auth-input-password"
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          disabled={disabled}
          minLength={minLength}
          spellCheck={false}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-pressed={visible}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
