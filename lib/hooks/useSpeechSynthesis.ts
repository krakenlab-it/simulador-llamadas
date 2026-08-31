"use client";

import { useCallback, useEffect, useState } from "react";
import { isSpeechSynthesisSupported } from "@/lib/extension-points/session";

const SPEECH_LANG = "es-MX";

export interface UseSpeechSynthesisResult {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported());
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisSupported() || !text.trim()) {
        return;
      }

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

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { supported, speaking, speak, cancel };
}
