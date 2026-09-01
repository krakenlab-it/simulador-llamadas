"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechSynthesisSupported } from "@/lib/extension-points/session";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getVoiceAuthHeaders } from "@/lib/auth/voice-email";

const SPEECH_LANG = "es-MX";

export interface UseSpeechSynthesisOptions {
  sessionUsageId?: string | null;
}

export interface UseSpeechSynthesisResult {
  supported: boolean;
  speaking: boolean;
  ttsTier: string;
  speak: (text: string) => void;
  cancel: () => void;
}

async function fetchServerAudio(
  text: string,
  sessionUsageId?: string | null,
): Promise<{ blob: Blob | null; fallback: boolean }> {
  const authHeaders = await getVoiceAuthHeaders();
  const response = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ text, sessionUsageId }),
  });
  if (response.status === 429) return { blob: null, fallback: true };
  if (!response.ok) return { blob: null, fallback: false };
  return { blob: await response.blob(), fallback: false };
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisResult {
  const { sessionUsageId } = options;
  const voiceConfig = useVoiceConfig();
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const useServerTts =
    voiceConfig.serverTts &&
    (!voiceConfig.requiresVoiceAuth || Boolean(sessionUsageId));

  useEffect(() => {
    const browserOk = isSpeechSynthesisSupported();
    const elevenLabsNeedsAuth =
      voiceConfig.ttsTier === "elevenlabs" && voiceConfig.requiresVoiceAuth;
    setSupported(
      browserOk ||
        (voiceConfig.serverTts && (!elevenLabsNeedsAuth || Boolean(sessionUsageId))),
    );
  }, [voiceConfig, sessionUsageId]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    revokeObjectUrl();
    setSpeaking(false);
  }, [revokeObjectUrl]);

  const speakBrowser = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisSupported()) return;

      cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LANG;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [cancel],
  );

  const speakServer = useCallback(
    async (text: string) => {
      cancel();
      const { blob, fallback } = await fetchServerAudio(text, sessionUsageId);
      if (!blob || fallback) {
        speakBrowser(text);
        return;
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        revokeObjectUrl();
      };
      audio.onerror = () => {
        setSpeaking(false);
        revokeObjectUrl();
        speakBrowser(text);
      };
      void audio.play();
    },
    [cancel, revokeObjectUrl, sessionUsageId, speakBrowser],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (useServerTts) {
        void speakServer(text);
        return;
      }
      speakBrowser(text);
    },
    [useServerTts, speakServer, speakBrowser],
  );

  useEffect(() => cancel, [cancel]);

  return {
    supported,
    speaking,
    ttsTier: voiceConfig.ttsTier,
    speak,
    cancel,
  };
}
