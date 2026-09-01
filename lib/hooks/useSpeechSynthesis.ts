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
  waitForSharedAudioEnd,
} from "@/lib/voice/client-playback";
import {
  SPEAKING_WATCHDOG_MS,
  TTS_FETCH_TIMEOUT_MS,
  TTS_PLAY_TIMEOUT_MS,
} from "@/lib/voice/timeouts";

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
const BROWSER_SPEAK_TIMEOUT_MS = 30_000;

const FALLBACK_HTTP_STATUSES = new Set([429, 502, 503]);

type FetchServerAudioResult = {
  blob: Blob | null;
  fallback: boolean;
  status?: number;
};

async function fetchServerAudio(
  text: string,
  sessionUsageId: string | null | undefined,
  signal: AbortSignal,
): Promise<FetchServerAudioResult> {
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
    signal,
  });

  if (FALLBACK_HTTP_STATUSES.has(response.status)) {
    return { blob: null, fallback: true, status: response.status };
  }
  if (!response.ok) {
    return { blob: null, fallback: true, status: response.status };
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/")) {
    return { blob: null, fallback: true, status: response.status };
  }
  return { blob: await response.blob(), fallback: false, status: response.status };
}

function speakWithBrowserSynthesis(
  text: string,
  onEnd: () => void,
  timeoutMs = BROWSER_SPEAK_TIMEOUT_MS,
): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeout);
    onEnd();
  };

  const timeout = window.setTimeout(finish, timeoutMs);

  let started = false;
  const start = () => {
    if (started || finished) return;
    started = true;
    const utterance = new SpeechSynthesisUtterance(text);
    applySpanishVoice(utterance);
    utterance.onend = finish;
    utterance.onerror = finish;
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
  const fetchAbortRef = useRef<AbortController | null>(null);

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

  const clearSpeaking = useCallback(() => {
    setSpeaking(false);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    generationRef.current += 1;
    pendingTextRef.current = null;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
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
    (text: string, generation: number) => {
      if (!isSpeechSynthesisSupported()) {
        if (generation === generationRef.current) clearSpeaking();
        return;
      }
      setSpeaking(true);
      speakWithBrowserSynthesis(text, () => {
        if (generation !== generationRef.current || cancelledRef.current) return;
        clearSpeaking();
      });
    },
    [clearSpeaking],
  );

  const speakServer = useCallback(
    async (text: string) => {
      cancelledRef.current = false;
      const generation = generationRef.current;
      setSpeaking(true);

      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        TTS_FETCH_TIMEOUT_MS,
      );

      let blob: Blob | null = null;
      let fallback = true;

      try {
        const result = await fetchServerAudio(
          text,
          sessionUsageId,
          controller.signal,
        );
        blob = result.blob;
        fallback = result.fallback;
      } catch {
        fallback = true;
      } finally {
        window.clearTimeout(timeoutId);
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }
      }

      if (generation !== generationRef.current || cancelledRef.current) {
        clearSpeaking();
        return;
      }

      if (!blob || fallback) {
        speakBrowser(text, generation);
        return;
      }

      const url =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(blob)
          : "blob:tts";
      objectUrlRef.current = url;

      try {
        await playSharedAudio(url);
        if (generation !== generationRef.current || cancelledRef.current) return;
        await waitForSharedAudioEnd(TTS_PLAY_TIMEOUT_MS);
      } catch {
        if (generation !== generationRef.current || cancelledRef.current) return;
        if (!isClientPlaybackUnlocked()) {
          pendingTextRef.current = text;
          return;
        }
        speakBrowser(text, generation);
        return;
      } finally {
        revokeObjectUrl();
      }

      if (generation === generationRef.current && !cancelledRef.current) {
        clearSpeaking();
      }
    },
    [clearSpeaking, revokeObjectUrl, sessionUsageId, speakBrowser],
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
      const generation = generationRef.current;
      speakBrowser(text, generation);
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
      speakBrowser(pending, generationRef.current);
    });
  }, [useServerTts, speakServer, speakBrowser]);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    if (!speaking) return;
    const timer = window.setTimeout(() => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      const audio = getSharedCallAudio();
      audio?.pause();
      if (audio) audio.currentTime = 0;
      clearSpeaking();
    }, SPEAKING_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [speaking, clearSpeaking]);

  return {
    supported,
    speaking,
    ttsTier: voiceConfig.ttsTier,
    speak,
    cancel,
  };
}
