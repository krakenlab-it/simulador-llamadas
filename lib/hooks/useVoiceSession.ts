"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  endBilledVoiceSession,
  startBilledVoiceSession,
} from "@/lib/auth/voice-session";
import { voiceSessionFetch } from "@/lib/hooks/useConvaiConnection";
import { useVoiceConfig } from "@/lib/hooks/useVoiceConfig";
import { SESSION_CONVAI_MAX_SECONDS } from "@/lib/voice/brakes";

export interface VoiceSessionState {
  sessionUsageId: string | null;
  verifiedUserId: string | null;
  billedActive: boolean;
  remainingConvaiSeconds: number;
  warnLowTime: boolean;
  fallbackToBrowser: boolean;
}

export interface VoiceSessionOptions {
  /**
   * Bill ConvAI seconds only while the ConvAI agent is actually carrying the
   * audio. The ConvAI budget also gates ElevenLabs TTS, so metering it on
   * wall-clock time would silence a browser-mic call after three minutes.
   */
  meterConvaiSeconds?: boolean;
}

export function useVoiceSession(
  verifiedUserId: string | null,
  callAttemptId: string | null,
  mode: "voz" | "texto",
  options: VoiceSessionOptions = {},
): VoiceSessionState {
  const { meterConvaiSeconds = false } = options;
  const voiceConfig = useVoiceConfig();
  const [sessionUsageId, setSessionUsageId] = useState<string | null>(null);
  const [resolvedVerifiedUserId, setResolvedVerifiedUserId] = useState<string | null>(
    verifiedUserId,
  );
  const [billedActive, setBilledActive] = useState(false);
  const [remainingConvaiSeconds, setRemainingConvaiSeconds] = useState(
    SESSION_CONVAI_MAX_SECONDS,
  );
  const [warnLowTime, setWarnLowTime] = useState(false);
  const [fallbackToBrowser, setFallbackToBrowser] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const sessionUsageIdRef = useRef<string | null>(null);

  const startSession = useCallback(async () => {
    if (
      mode !== "voz" ||
      !voiceConfig.requiresVoiceAuth ||
      startedRef.current
    ) {
      return;
    }
    startedRef.current = true;

    const result = await startBilledVoiceSession(callAttemptId ?? undefined);

    if (result.fallbackToBrowser || !result.sessionUsageId) {
      setFallbackToBrowser(true);
      return;
    }

    sessionUsageIdRef.current = result.sessionUsageId;
    setSessionUsageId(result.sessionUsageId);
    setResolvedVerifiedUserId(result.verifiedUserId ?? verifiedUserId);
    setBilledActive(true);
  }, [mode, voiceConfig.requiresVoiceAuth, callAttemptId, verifiedUserId]);

  useEffect(() => {
    void startSession();
    return () => {
      const id = sessionUsageIdRef.current;
      if (id) void endBilledVoiceSession(id);
    };
  }, [startSession]);

  useEffect(() => {
    if (!sessionUsageId || fallbackToBrowser) return;

    void voiceSessionFetch(
      `/api/voice/session/usage?sessionUsageId=${sessionUsageId}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { remainingConvaiSeconds: number; warnLowTime: boolean } | null) => {
        if (!data) return;
        setRemainingConvaiSeconds(data.remainingConvaiSeconds);
        setWarnLowTime(data.warnLowTime);
      });

    if (!meterConvaiSeconds) return;

    tickRef.current = setInterval(() => {
      void voiceSessionFetch("/api/voice/session/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionUsageId, convaiSeconds: 1 }),
      }).then(async (res) => {
        if (res.status === 429) {
          setFallbackToBrowser(true);
          setBilledActive(false);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          remainingConvaiSeconds: number;
          warnLowTime: boolean;
        };
        setRemainingConvaiSeconds(data.remainingConvaiSeconds);
        setWarnLowTime(data.warnLowTime);
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [sessionUsageId, fallbackToBrowser, meterConvaiSeconds]);

  return {
    sessionUsageId: fallbackToBrowser ? null : sessionUsageId,
    verifiedUserId: resolvedVerifiedUserId,
    billedActive: billedActive && !fallbackToBrowser,
    remainingConvaiSeconds,
    warnLowTime,
    fallbackToBrowser,
  };
}
