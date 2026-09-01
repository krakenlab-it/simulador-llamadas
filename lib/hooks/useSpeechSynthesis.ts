"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechSynthesisSupported } from "@/lib/extension-points/session";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getVoiceAuthHeaders } from "@/lib/auth/voice-session";
import {
  applySpanishVoice,
  getSharedCallAudio,
  isClientPlaybackUnlocked,
  onClientPlaybackUnlocked,
  playSharedAudio,
} from "@/lib/voice/client-playback";

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

const BROWSER_SPEAK_DELAY_MS = 60;
/** Safety valve when play()/speechSynthesis never fires onend (would block STT). */
const SPEAKING_WATCHDOG_MS = 45_000;

async function fetchServerAudio(
  text: string,
  sessionUsageId?: string | null,
): Promise<{ blob: Blob | null; fallback: boolean }> {
  const authHeaders = await getVoiceAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    "Content-Type": "application/json",
  };
  if (sessionUsageId) headers["x-voice-session-id"] = sessionUsageId;

  const response = await fetch("/api/voice/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({ text, sessionUsageId }),
  });
  if (response.status === 429) return { blob: null, fallback: true };
  if (!response.ok) return { blob: null, fallback: true };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/")) return { blob: null, fallback: true };
  return { blob: await response.blob(), fallback: false };
}

function speakWithBrowserSynthesis(text: string, onEnd: () => void): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const utterance = new SpeechSynthesisUtterance(text);
    applySpanishVoice(utterance);
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    synth.resume();
    synth.speak(utterance);
  };

  const voicesReady = synth.getVoices().length > 0;
  window.setTimeout(start, voicesReady ? BROWSER_SPEAK_DELAY_MS : 120);
  if (!voicesReady) {
    synth.addEventListener("voiceschanged", start, { once: true });
  }
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisResult {
  const { sessionUsageId } = options;
  const voiceConfig = useVoiceConfig();
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const pendingTextRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

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
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    generationRef.current += 1;
    pendingTextRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const audio = getSharedCallAudio();
    audio?.pause();
    if (audio) audio.currentTime = 0;
    revokeObjectUrl();
    setSpeaking(false);
  }, [revokeObjectUrl]);

  const speakBrowser = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisSupported()) {
        setSpeaking(false);
        return;
      }
      cancelledRef.current = false;
      setSpeaking(true);
      speakWithBrowserSynthesis(text, () => {
        if (!cancelledRef.current) setSpeaking(false);
      });
    },
    [],
  );

  const speakServer = useCallback(
    async (text: string) => {
      cancelledRef.current = false;
      const generation = generationRef.current;
      setSpeaking(true);

      const { blob, fallback } = await fetchServerAudio(text, sessionUsageId);
      if (generation !== generationRef.current || cancelledRef.current) return;

      if (!blob || fallback) {
        speakBrowser(text);
        return;
      }

      const url =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(blob)
          : "blob:tts";
      objectUrlRef.current = url;

      const play = async () => {
        if (generation !== generationRef.current || cancelledRef.current) return;
        try {
          await playSharedAudio(url);
        } catch {
          if (generation !== generationRef.current || cancelledRef.current) return;
          if (!isClientPlaybackUnlocked()) {
            pendingTextRef.current = text;
            return;
          }
          speakBrowser(text);
        }
      };

      const audio = getSharedCallAudio();
      if (audio) {
        audio.onplay = () => {
          if (generation === generationRef.current) setSpeaking(true);
        };
        audio.onended = () => {
          if (generation !== generationRef.current) return;
          setSpeaking(false);
          revokeObjectUrl();
        };
        audio.onerror = () => {
          if (generation !== generationRef.current || cancelledRef.current) return;
          setSpeaking(false);
          revokeObjectUrl();
          speakBrowser(text);
        };
      }

      await play();
    },
    [revokeObjectUrl, sessionUsageId, speakBrowser],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      cancelledRef.current = false;

      if (!isClientPlaybackUnlocked()) {
        pendingTextRef.current = text;
        setSpeaking(true);
        return;
      }

      if (useServerTts) {
        void speakServer(text);
        return;
      }
      speakBrowser(text);
    },
    [useServerTts, speakServer, speakBrowser],
  );

  useEffect(() => {
    return onClientPlaybackUnlocked(() => {
      const pending = pendingTextRef.current;
      if (!pending) return;
      pendingTextRef.current = null;
      if (useServerTts) {
        void speakServer(pending);
        return;
      }
      speakBrowser(pending);
    });
  }, [useServerTts, speakServer, speakBrowser]);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    if (!speaking) return;
    const timer = window.setTimeout(() => {
      setSpeaking(false);
    }, SPEAKING_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [speaking]);

  return {
    supported,
    speaking,
    ttsTier: voiceConfig.ttsTier,
    speak,
    cancel,
  };
}
