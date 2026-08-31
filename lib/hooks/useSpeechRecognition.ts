"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechRecognitionSupported } from "@/lib/extension-points/session";

const SPEECH_LANG = "es-MX";

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  appendToField: (current: string) => string;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const getRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      return null;
    }
    return new Ctor();
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const recognition = getRecognition();
    if (!recognition) {
      setError("Web Speech API no disponible en este navegador.");
      return;
    }

    recognitionRef.current?.abort();
    recognition.lang = SPEECH_LANG;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
    };

    recognition.onerror = (event) => {
      setError(`Error de micrófono: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [getRecognition]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  const appendToField = useCallback(
    (current: string) => {
      if (!transcript) {
        return current;
      }
      return (current ? `${current} ${transcript}` : transcript).trim();
    },
    [transcript],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    supported,
    listening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    appendToField,
  };
}
