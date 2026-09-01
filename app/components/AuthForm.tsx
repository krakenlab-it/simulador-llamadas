"use client";

import { useId, useState } from "react";
import {
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/auth/actions";
import { validateSignIn, validateSignUp } from "@/lib/auth/validation";
import { AuthPasswordField } from "@/app/components/AuthPasswordField";
import "@/app/auth.css";

export type AuthMode = "signin" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => void;
  showModeToggle?: boolean;
}

export function AuthForm({
  mode,
  onModeChange,
  onSuccess,
  showModeToggle = true,
}: AuthFormProps) {
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    setSubmitError(null);

    if (mode === "signup") {
      const validationError = validateSignUp({ email, password, confirmPassword });
      if (validationError) {
        setFieldError(validationError);
        return;
      }
    } else {
      const validationError = validateSignIn(email, password);
      if (validationError) {
        setFieldError(validationError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const result =
        mode === "signup"
          ? await signUpWithPassword(email, password)
          : await signInWithPassword(email, password);

      if (!result.ok) {
        setSubmitError(result.error ?? "No se pudo completar la autenticación.");
        return;
      }

      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;

  return (
    <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {showModeToggle && (
        <div className="auth-mode-toggle" role="tablist" aria-label="Tipo de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              onModeChange("signin");
              setFieldError(null);
              setSubmitError(null);
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              onModeChange("signup");
              setFieldError(null);
              setSubmitError(null);
            }}
          >
            Registrarse
          </button>
        </div>
      )}

      <div className="auth-fields">
        <div className="auth-field">
          <label className="auth-label" htmlFor={emailId}>
            Correo electrónico
          </label>
          <input
            id={emailId}
            className="auth-input"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={submitting}
            placeholder="tu@correo.com"
          />
        </div>

        <AuthPasswordField
          id={passwordId}
          name="password"
          label="Contraseña"
          value={password}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          disabled={submitting}
          onChange={setPassword}
        />

        {mode === "signup" && (
          <AuthPasswordField
            id={confirmId}
            name="confirmPassword"
            label="Confirmar contraseña"
            value={confirmPassword}
            autoComplete="new-password"
            disabled={submitting}
            onChange={setConfirmPassword}
          />
        )}
      </div>

      {(fieldError || submitError) && (
        <p className="auth-alert" role="alert">
          {fieldError ?? submitError}
        </p>
      )}

      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting
          ? "Procesando…"
          : mode === "signup"
            ? "Crear cuenta"
            : "Entrar al simulador"}
      </button>
    </form>
  );
}
