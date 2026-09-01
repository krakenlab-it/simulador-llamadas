"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getVoiceAuthHeaders,
  startConvaiSession,
} from "@/lib/auth/voice-session";

export interface UseConvaiConnectionOptions {
  sessionUsageId: string | null;
  clientName: string;
  scenarioContext: string;
  enabled: boolean;
  onAgentTranscript?: (text: string) => void;
}

export interface UseConvaiConnectionResult {
  connected: boolean;
  agentSpeaking: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Barge-in: interrupt agent playback and signal ConvAI. */
  interrupt: () => void;
}

interface ConvaiEvent {
  type?: string;
  audio_event?: { audio_base_64?: string };
  agent_response_event?: { agent_response?: string };
  interruption_event?: Record<string, unknown>;
}

export function useConvaiConnection(
  options: UseConvaiConnectionOptions,
): UseConvaiConnectionResult {
  const { sessionUsageId, clientName, scenarioContext, enabled, onAgentTranscript } =
    options;
  const [connected, setConnected] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const connectingRef = useRef(false);

  const revokeAudio = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAgentSpeaking(false);
  }, []);

  const disconnect = useCallback(() => {
    revokeAudio();
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    connectingRef.current = false;
  }, [revokeAudio]);

  const playAgentAudio = useCallback(
    (base64: string) => {
      revokeAudio();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setAgentSpeaking(true);
      audio.onended = () => {
        setAgentSpeaking(false);
        revokeAudio();
      };
      audio.onerror = () => {
        setAgentSpeaking(false);
        revokeAudio();
      };
      void audio.play();
    },
    [revokeAudio],
  );

  const interrupt = useCallback(() => {
    revokeAudio();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "interruption" }));
    }
  }, [revokeAudio]);

  const connect = useCallback(() => {
    if (!enabled || !sessionUsageId || connectingRef.current || wsRef.current) return;
    connectingRef.current = true;

    void startConvaiSession({
      sessionUsageId,
      clientName,
      scenarioContext,
    }).then((result) => {
      connectingRef.current = false;
      if (result.fallbackToBrowser || !result.signedUrl) {
        disconnect();
        return;
      }

      const ws = new WebSocket(result.signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: "conversation_initiation_client_data",
            conversation_config_override: {
              agent: { language: "es" },
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as ConvaiEvent;
          if (data.type === "interruption" || data.interruption_event) {
            revokeAudio();
            return;
          }
          const audioB64 = data.audio_event?.audio_base_64;
          if (audioB64) playAgentAudio(audioB64);
          const agentText = data.agent_response_event?.agent_response;
          if (agentText && onAgentTranscript) onAgentTranscript(agentText);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        disconnect();
      };
    });
  }, [
    enabled,
    sessionUsageId,
    clientName,
    scenarioContext,
    disconnect,
    playAgentAudio,
    revokeAudio,
    onAgentTranscript,
  ]);

  useEffect(() => disconnect, [disconnect]);

  return { connected, agentSpeaking, connect, disconnect, interrupt };
}

/** Auth-aware fetch headers for voice session usage ticks. */
export async function voiceSessionFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const authHeaders = await getVoiceAuthHeaders();
  return fetch(url, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers as Record<string, string>) },
  });
}
