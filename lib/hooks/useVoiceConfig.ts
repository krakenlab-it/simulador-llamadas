"use client";

import { useEffect, useState } from "react";

export interface VoiceConfig {
  sttTier: string;
  ttsTier: string;
  convaiEnabled: boolean;
  pronunciationDictionary: boolean;
  serverStt: boolean;
  serverTts: boolean;
  elevenlabsBilledAvailable: boolean;
  requiresVoiceAuth: boolean;
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
    sessionConvaiMaxSeconds: 180,
    sessionConvaiWarnRemainingSeconds: 30,
    sessionMaxRounds: 5,
    sessionExtraTtsMaxChars: 2500,
    dailyBilledSessionsPerUser: 1,
    globalMaxConcurrentConvai: 2,
    globalMonthlyConvaiMinutes: 300,
  },
};

export function useVoiceConfig(): VoiceConfig {
  const [config, setConfig] = useState<VoiceConfig>(BROWSER_DEFAULT);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/voice/config")
      .then((res) => (res.ok ? res.json() : BROWSER_DEFAULT))
      .then((data: VoiceConfig) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig(BROWSER_DEFAULT);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
