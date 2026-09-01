"use client";

import { useEffect, useRef, useState } from "react";
import { AuthForm, type AuthMode } from "@/app/components/AuthForm";
import { registerVerifiedVoiceUser } from "@/lib/auth/voice-session";
import { useAuth } from "@/lib/auth/context";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import "@/app/auth.css";

interface VoiceAuthGateProps {
  onVerified: (verifiedUserId: string, email: string) => void;
  onSkip: () => void;
}

export function VoiceAuthGate({ onVerified, onSkip }: VoiceAuthGateProps) {
  const voiceConfig = useVoiceConfig();
  const { session } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!session?.user.email) return;

    let cancelled = false;
    setRegistering(true);
    setRegisterError(null);

    void registerVerifiedVoiceUser().then((result) => {
      if (cancelled) return;
      setRegistering(false);
      if (!result) {
        setRegisterError("No se pudo verificar la sesión para voz facturada.");
        return;
      }
      onVerifiedRef.current(result.verifiedUserId, result.email);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, session?.user.email]);

  if (!voiceConfig.requiresVoiceAuth) {
    return null;
  }

  if (registering) {
    return <p className="auth-status">Verificando sesión para voz con IA…</p>;
  }

  if (registerError) {
    return (
      <p className="auth-alert" role="alert">
        {registerError}
      </p>
    );
  }

  return (
    <div className="auth-card auth-card-inline" aria-label="Acceso a voz con IA">
      <p className="auth-kicker">Voz con IA</p>
      <h3 className="auth-title auth-title-sm">Acceso a ElevenLabs</h3>
      <p className="auth-lead">
        Inicia sesión o regístrate para usar la voz facturada. Una sesión con voz
        por día; los reintentos del mismo día usan voz del navegador.
      </p>

      <AuthForm
        mode={mode}
        onModeChange={setMode}
        onSuccess={() => {
          /* Session listener above registers verified user. */
        }}
      />

      <footer className="auth-footer">
        <button type="button" className="auth-secondary-button" onClick={onSkip}>
          Usar voz del navegador
        </button>
      </footer>
    </div>
  );
}
