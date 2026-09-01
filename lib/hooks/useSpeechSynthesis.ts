"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechSynthesisSupported } from "@/lib/extension-points/session";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { getVoiceAuthHeaders } from "@/lib/auth/voice-session";
import {
  cancelBrowserSpeech,
  getSharedCallAudio,
  isClientPlaybackUnlocked,
  onClientPlaybackUnlocked,
  playSharedAudio,
  speakSpanishText,
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
  const fetchAbortRef = useRef<AbortController | null>(null);
  const stopBrowserSpeechRef = useRef<(() => void) | null>(null);

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

  /**
   * Every utterance gets its own id. Only the newest one may clear `speaking`,
   * so a superseded turn can never release the mic out from under the live one.
   */
  const nextGeneration = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const stopBrowserSpeech = useCallback(() => {
    stopBrowserSpeechRef.current?.();
    stopBrowserSpeechRef.current = null;
    cancelBrowserSpeech();
  }, []);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    pendingTextRef.current = null;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    stopBrowserSpeech();
    const audio = getSharedCallAudio();
    audio?.pause();
    if (audio) audio.currentTime = 0;
    revokeObjectUrl();
    setSpeaking(false);
  }, [revokeObjectUrl, stopBrowserSpeech]);

  /**
   * Audible fallback for every billed failure. It must always end by clearing
   * `speaking`, even when the browser engine is missing or mute, or the call
   * would sit on "Reanudando micrófono…" until the watchdog fires.
   */
  const speakBrowser = useCallback(
    (text: string, generation: number) => {
      if (!isSpeechSynthesisSupported()) {
        if (generation === generationRef.current) clearSpeaking();
        return;
      }
      setSpeaking(true);
      stopBrowserSpeechRef.current?.();
      stopBrowserSpeechRef.current = speakSpanishText(text, () => {
        stopBrowserSpeechRef.current = null;
        if (generation !== generationRef.current) return;
        clearSpeaking();
      });
    },
    [clearSpeaking],
  );

  const speakServer = useCallback(
    async (text: string, generation: number) => {
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

      const superseded = () => generation !== generationRef.current;

      if (superseded()) return;

      // 502/503/429, a non-audio body, a timeout or a network error all land
      // here: say the same Spanish line with the browser engine.
      if (!blob || fallback) {
        speakBrowser(text, generation);
        return;
      }

      const url =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(blob)
          : "blob:tts";
      objectUrlRef.current = url;

      let playbackFailed = false;
      try {
        await playSharedAudio(url);
        if (!superseded()) {
          await waitForSharedAudioEnd(TTS_PLAY_TIMEOUT_MS);
        }
      } catch {
        playbackFailed = true;
      }
      revokeObjectUrl();

      if (superseded()) return;
      // Billed bytes arrived but the element refused them: speak, do not go mute.
      if (playbackFailed) {
        speakBrowser(text, generation);
        return;
      }
      clearSpeaking();
    },
    [clearSpeaking, revokeObjectUrl, sessionUsageId, speakBrowser],
  );

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (!isClientPlaybackUnlocked()) {
        pendingTextRef.current = text;
        setSpeaking(true);
        return;
      }

      const generation = nextGeneration();
      if (useServerTts) {
        void speakServer(text, generation);
        return;
      }
      speakBrowser(text, generation);
    },
    [nextGeneration, useServerTts, speakServer, speakBrowser],
  );

  useEffect(() => {
    return onClientPlaybackUnlocked(() => {
      const pending = pendingTextRef.current;
      if (!pending) return;
      pendingTextRef.current = null;
      const generation = nextGeneration();
      if (useServerTts) {
        void speakServer(pending, generation);
        return;
      }
      speakBrowser(pending, generation);
    });
  }, [nextGeneration, useServerTts, speakServer, speakBrowser]);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    if (!speaking) return;
    const timer = window.setTimeout(() => {
      stopBrowserSpeech();
      const audio = getSharedCallAudio();
      audio?.pause();
      if (audio) audio.currentTime = 0;
      clearSpeaking();
    }, SPEAKING_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [speaking, clearSpeaking, stopBrowserSpeech]);

  return {
    supported,
    speaking,
    ttsTier: voiceConfig.ttsTier,
    speak,
    cancel,
  };
}
