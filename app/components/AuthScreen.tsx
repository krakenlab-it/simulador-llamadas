"use client";

import { useState } from "react";
import { AuthForm, type AuthMode } from "@/app/components/AuthForm";
import "@/app/auth.css";

interface AuthScreenProps {
  onAuthenticated: () => void;
  onContinueTextOnly: () => void;
}

export function AuthScreen({
  onAuthenticated,
  onContinueTextOnly,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <header className="auth-header">
          <p className="auth-wordmark">
            Simulador <span>de Llamadas</span>
          </p>
        </header>

        <section className="auth-card" aria-label="Acceso al simulador">
          <p className="auth-kicker">Formación comercial</p>
          <h1 className="auth-title">Accede al simulador</h1>
          <p className="auth-lead">
            Crea una cuenta o inicia sesión para practicar. La voz con IA facturada
            requiere identidad verificada. El modo texto puede usarse sin cuenta.
          </p>

          <AuthForm
            mode={mode}
            onModeChange={setMode}
            onSuccess={onAuthenticated}
          />

          <footer className="auth-footer">
            <button
              type="button"
              className="auth-text-link"
              onClick={onContinueTextOnly}
            >
              Continuar en modo texto sin cuenta
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
