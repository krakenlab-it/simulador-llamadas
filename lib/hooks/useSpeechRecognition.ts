"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechRecognitionSupported } from "@/lib/extension-points/session";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";

const SPEECH_LANG = "es-MX";

export interface UseSpeechRecognitionOptions {
  sessionUsageId?: string | null;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  sttTier: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  appendToField: (current: string) => string;
}

async function transcribeOnServer(
  audioBlob: Blob,
  sessionUsageId?: string | null,
): Promise<{ transcript: string; tier: string; fallbackToBrowser?: boolean } | null> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");

  const headers: Record<string, string> = {};
  if (sessionUsageId) headers["x-voice-session-id"] = sessionUsageId;

  const response = await fetch("/api/voice/stt", { method: "POST", body: form, headers });
  if (response.status === 429) {
    return { transcript: "", tier: "browser", fallbackToBrowser: true };
  }
  if (!response.ok) return null;
  return response.json() as Promise<{ transcript: string; tier: string }>;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const { sessionUsageId } = options;
  const voiceConfig = useVoiceConfig();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const useServerStt =
    voiceConfig.serverStt && voiceConfig.sttTier !== "elevenlabs-scribe"
      ? voiceConfig.serverStt
      : voiceConfig.serverStt &&
        (!voiceConfig.requiresVoiceAuth || Boolean(sessionUsageId));

  useEffect(() => {
    const browserOk = isSpeechRecognitionSupported();
    const elevenLabsNeedsAuth =
      voiceConfig.sttTier === "elevenlabs-scribe" && voiceConfig.requiresVoiceAuth;
    setSupported(
      browserOk ||
        (voiceConfig.serverStt && (!elevenLabsNeedsAuth || Boolean(sessionUsageId))),
    );
  }, [voiceConfig, sessionUsageId]);

  const getRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === "undefined") return null;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return null;
    return new Ctor();
  }, []);

  const cleanupMedia = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  const startBrowserRecognition = useCallback(() => {
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

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [getRecognition]);

  const startServerRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        void (async () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          cleanupMedia();

          if (blob.size === 0) {
            setError("No se capturó audio.");
            setListening(false);
            return;
          }

          const result = await transcribeOnServer(blob, sessionUsageId);
          if (result?.fallbackToBrowser || !result?.transcript) {
            if (isSpeechRecognitionSupported()) {
              startBrowserRecognition();
              return;
            }
            setError("No se pudo transcribir el audio.");
            setListening(false);
            return;
          }

          setTranscript((prev) =>
            prev ? `${prev} ${result.transcript}` : result.transcript,
          );
          setListening(false);
        })();
      };

      mediaRecorderRef.current = recorder;
      setListening(true);
      recorder.start();
    } catch {
      if (isSpeechRecognitionSupported()) {
        startBrowserRecognition();
        return;
      }
      setError("No se pudo acceder al micrófono.");
      setListening(false);
    }
  }, [cleanupMedia, sessionUsageId, startBrowserRecognition]);

  const startListening = useCallback(() => {
    setError(null);
    if (useServerStt) {
      void startServerRecording();
      return;
    }
    startBrowserRecognition();
  }, [useServerStt, startServerRecording, startBrowserRecognition]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  const appendToField = useCallback(
    (current: string) => {
      if (!transcript) return current;
      return (current ? `${current} ${transcript}` : transcript).trim();
    },
    [transcript],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    supported,
    listening,
    transcript,
    error,
    sttTier: voiceConfig.sttTier,
    startListening,
    stopListening,
    resetTranscript,
    appendToField,
  };
}
