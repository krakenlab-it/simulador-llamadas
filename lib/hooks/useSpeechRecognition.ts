"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechRecognitionSupported } from "@/lib/extension-points/session";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getVoiceAuthHeaders } from "@/lib/auth/voice-session";
import { openMicCaptureStream } from "@/lib/voice/call-devices";
import { STT_RESTART_TIMEOUT_MS } from "@/lib/voice/timeouts";

const SPEECH_LANG = "es-MX";
const RESTART_DELAY_MS = 180;

/** Chrome ends a pause with this; it is not a broken mic. */
const SOFT_RECOGNITION_ERRORS = new Set(["no-speech", "aborted"]);

export interface UseSpeechRecognitionOptions {
  sessionUsageId?: string | null;
  /** Keep Web Speech running for the whole call; restart after no-speech. */
  keepAlive?: boolean;
  /** Pause while the client is talking so we do not transcribe TTS. */
  paused?: boolean;
  /** Preferred mic device (getUserMedia); Web Speech may still use system default. */
  micDeviceId?: string | null;
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
  ensureListening: () => void;
}

async function transcribeOnServer(
  audioBlob: Blob,
  sessionUsageId?: string | null,
): Promise<{ transcript: string; tier: string; fallbackToBrowser?: boolean } | null> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");

  const headers: Record<string, string> = {};
  const authHeaders = await getVoiceAuthHeaders();
  Object.assign(headers, authHeaders);
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
  const { sessionUsageId, keepAlive = false, paused = false, micDeviceId } = options;
  const voiceConfig = useVoiceConfig();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef(keepAlive);
  const pausedRef = useRef(paused);
  const micDeviceIdRef = useRef(micDeviceId);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUtteranceRestartRef = useRef(false);
  const captureGenerationRef = useRef(0);
  const startBrowserRecognitionRef = useRef<() => void>(() => undefined);

  keepAliveRef.current = keepAlive;
  pausedRef.current = paused;
  micDeviceIdRef.current = micDeviceId;

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
    captureGenerationRef.current += 1;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  const clearListeningWatchdog = useCallback(() => {
    if (listeningWatchdogRef.current) {
      clearTimeout(listeningWatchdogRef.current);
      listeningWatchdogRef.current = null;
    }
  }, []);

  const scheduleListeningWatchdog = useCallback(() => {
    clearListeningWatchdog();
    if (!keepAliveRef.current || pausedRef.current) return;
    listeningWatchdogRef.current = setTimeout(() => {
      listeningWatchdogRef.current = null;
      if (!keepAliveRef.current || pausedRef.current) return;
      if (recognitionRef.current || mediaRecorderRef.current) return;
      startBrowserRecognitionRef.current();
    }, STT_RESTART_TIMEOUT_MS);
  }, [clearListeningWatchdog]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    if (!keepAliveRef.current || pausedRef.current) return;
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!keepAliveRef.current || pausedRef.current) return;
      startBrowserRecognitionRef.current();
    }, RESTART_DELAY_MS);
  }, [clearRestartTimer]);

  const releaseMicCapture = useCallback(() => {
    clearRestartTimer();
    clearListeningWatchdog();
    pendingUtteranceRestartRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    cleanupMedia();
    setListening(false);
  }, [cleanupMedia, clearListeningWatchdog, clearRestartTimer]);

  const primeMicCapture = useCallback(async () => {
    if (streamRef.current) return;
    const generation = captureGenerationRef.current;
    try {
      const stream = await openMicCaptureStream(micDeviceIdRef.current);
      if (generation !== captureGenerationRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
    } catch {
      // Web Speech can still run on the default device.
    }
  }, []);

  const startBrowserRecognition = useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) {
      setError("Web Speech API no disponible en este navegador.");
      return;
    }

    clearRestartTimer();
    clearListeningWatchdog();
    recognitionRef.current?.abort();
    recognition.lang = SPEECH_LANG;
    recognition.interimResults = false;
    recognition.continuous = false;

    let receivedResult = false;

    recognition.onresult = (event) => {
      receivedResult = true;
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
    };

    recognition.onerror = (event) => {
      if (SOFT_RECOGNITION_ERRORS.has(event.error)) {
        return;
      }
      setError(`Error de micrófono: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      if (receivedResult) {
        pendingUtteranceRestartRef.current = true;
        return;
      }
      if (keepAliveRef.current && !pausedRef.current) {
        scheduleRestart();
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    void primeMicCapture().finally(() => {
      if (recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        setListening(false);
        scheduleRestart();
      }
    });
  }, [clearListeningWatchdog, clearRestartTimer, getRecognition, primeMicCapture, scheduleRestart]);

  startBrowserRecognitionRef.current = startBrowserRecognition;

  const startServerRecording = useCallback(async () => {
    try {
      const stream = await openMicCaptureStream(micDeviceIdRef.current);
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
            pendingUtteranceRestartRef.current = keepAliveRef.current;
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
            pendingUtteranceRestartRef.current = keepAliveRef.current;
            return;
          }

          setTranscript((prev) =>
            prev ? `${prev} ${result.transcript}` : result.transcript,
          );
          setListening(false);
          pendingUtteranceRestartRef.current = keepAliveRef.current;
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
      pendingUtteranceRestartRef.current = keepAliveRef.current;
    }
  }, [cleanupMedia, sessionUsageId, startBrowserRecognition]);

  const startListening = useCallback(() => {
    setError(null);
    if (pausedRef.current) return;
    if (useServerStt) {
      void startServerRecording();
      return;
    }
    startBrowserRecognition();
  }, [useServerStt, startServerRecording, startBrowserRecognition]);

  const stopListening = useCallback(() => {
    clearRestartTimer();
    clearListeningWatchdog();
    pendingUtteranceRestartRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      mediaRecorderRef.current.stop();
      return;
    }
    releaseMicCapture();
  }, [clearListeningWatchdog, clearRestartTimer, releaseMicCapture]);

  const ensureListening = useCallback(() => {
    if (!keepAliveRef.current || pausedRef.current) return;
    if (recognitionRef.current || mediaRecorderRef.current) return;
    pendingUtteranceRestartRef.current = true;
    scheduleRestart();
    scheduleListeningWatchdog();
  }, [scheduleListeningWatchdog, scheduleRestart]);

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
    if (!keepAlive || paused) {
      clearRestartTimer();
      clearListeningWatchdog();
      pendingUtteranceRestartRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      cleanupMedia();
      if (paused) setListening(false);
      return;
    }

    if (!useServerStt) {
      if (pendingUtteranceRestartRef.current || !recognitionRef.current) {
        pendingUtteranceRestartRef.current = false;
        startBrowserRecognition();
      }
    }
  }, [
    paused,
    keepAlive,
    useServerStt,
    startBrowserRecognition,
    cleanupMedia,
    clearListeningWatchdog,
    clearRestartTimer,
  ]);

  useEffect(() => {
    if (listening) {
      clearListeningWatchdog();
      return;
    }
    if (keepAlive && !paused) {
      scheduleListeningWatchdog();
    }
  }, [clearListeningWatchdog, keepAlive, listening, paused, scheduleListeningWatchdog]);

  useEffect(() => {
    return () => {
      releaseMicCapture();
    };
  }, [releaseMicCapture]);

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
    ensureListening,
  };
}
