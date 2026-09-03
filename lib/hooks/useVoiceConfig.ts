"use client";

import { useEffect, useState } from "react";
import {
  DAILY_BILLED_SESSIONS_PER_USER,
  GLOBAL_MAX_CONCURRENT_CONVAI,
  GLOBAL_MONTHLY_CONVAI_MINUTES,
  SESSION_CONVAI_MAX_SECONDS,
  SESSION_CONVAI_WARN_REMAINING_SECONDS,
  SESSION_EXTRA_TTS_MAX_CHARS,
  SESSION_MAX_ROUNDS,
} from "@/lib/voice/brakes";

export interface VoiceConfig {
  sttTier: string;
  ttsTier: string;
  convaiEnabled: boolean;
  pronunciationDictionary: boolean;
  serverStt: boolean;
  serverTts: boolean;
  elevenlabsBilledAvailable: boolean;
  requiresVoiceAuth: boolean;
  /** False until /api/voice/config resolves. Omitted in tests means ready. */
  ready?: boolean;
  brakes: {
    sessionConvaiMaxSeconds: number;
    sessionConvaiWarnRemainingSeconds: number;
    sessionMaxRounds: number;
    sessionExtraTtsMaxChars: number;
    dailyBilledSessionsPerUser: number;
    globalMaxConcurrentConvai: number;
    globalMonthlyConvaiMinutes: number;
  };
}

const BROWSER_DEFAULT: VoiceConfig = {
  sttTier: "browser",
  ttsTier: "browser",
  convaiEnabled: false,
  pronunciationDictionary: false,
  serverStt: false,
  serverTts: false,
  elevenlabsBilledAvailable: false,
  requiresVoiceAuth: false,
  brakes: {
    sessionConvaiMaxSeconds: SESSION_CONVAI_MAX_SECONDS,
    sessionConvaiWarnRemainingSeconds: SESSION_CONVAI_WARN_REMAINING_SECONDS,
    sessionMaxRounds: SESSION_MAX_ROUNDS,
    sessionExtraTtsMaxChars: SESSION_EXTRA_TTS_MAX_CHARS,
    dailyBilledSessionsPerUser: DAILY_BILLED_SESSIONS_PER_USER,
    globalMaxConcurrentConvai: GLOBAL_MAX_CONCURRENT_CONVAI,
    globalMonthlyConvaiMinutes: GLOBAL_MONTHLY_CONVAI_MINUTES,
  },
};

export function useVoiceConfig(): VoiceConfig {
  const [config, setConfig] = useState<VoiceConfig>({
    ...BROWSER_DEFAULT,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/voice/config")
      .then((res) => (res.ok ? res.json() : BROWSER_DEFAULT))
      .then((data: VoiceConfig) => {
        if (!cancelled) setConfig({ ...data, ready: true });
      })
      .catch(() => {
        if (!cancelled) setConfig({ ...BROWSER_DEFAULT, ready: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
