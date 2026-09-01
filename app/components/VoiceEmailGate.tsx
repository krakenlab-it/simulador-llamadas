"use client";

import { useEffect, useState } from "react";
import {
  getStoredVoiceEmail,
  registerVerifiedVoiceUser,
  sendVoiceMagicLink,
  verifyVoiceSession,
} from "@/lib/auth/voice-email";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";

interface VoiceEmailGateProps {
  onVerified: (verifiedUserId: string, email: string) => void;
  onSkip: () => void;
}

export function VoiceEmailGate({ onVerified, onSkip }: VoiceEmailGateProps) {
  const voiceConfig = useVoiceConfig();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredVoiceEmail();
    if (stored) setEmail(stored);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("voice_auth") === "1") {
        setStatus("verifying");
        void verifyVoiceSession().then(async (result) => {
          if (!result.verified || !result.email) {
            setStatus("error");
            setMessage("No se pudo verificar el enlace. Intenta de nuevo.");
            return;
          }
          const reg = await registerVerifiedVoiceUser();
          if (!reg) {
            setStatus("error");
            setMessage("Error al registrar la verificación.");
            return;
          }
          onVerified(reg.verifiedUserId, reg.email);
        });
      }
    }
  }, [onVerified]);

  if (!voiceConfig.requiresVoiceAuth) {
    return null;
  }

  const handleSend = async () => {
    if (!email.trim()) return;
    setStatus("sending");
    setMessage(null);
    const result = await sendVoiceMagicLink(email);
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error ?? "Error al enviar el enlace.");
      return;
    }
    setStatus("sent");
    setMessage("Revisa tu correo y haz clic en el enlace mágico para continuar.");
  };

  return (
    <div className="mic-test">
      <p className="section-label">
        <strong>Verificación de correo (voz con IA)</strong>
      </p>
      <p className="subtitle">
        Para usar la voz con ElevenLabs, confirma tu correo. El modo texto no
        requiere verificación. Una sesión con voz facturada por día; los reintentos
        del mismo día usan voz del navegador.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        aria-label="Correo electrónico"
      />
      <div className="controls">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={status === "sending" || !email.trim()}
        >
          {status === "sending" ? "Enviando…" : "Enviar enlace mágico"}
        </button>
        <button type="button" onClick={onSkip}>
          Usar voz del navegador
        </button>
      </div>
      {message && (
        <p className={`note ${status === "error" ? "warn" : ""}`}>{message}</p>
      )}
    </div>
  );
}
