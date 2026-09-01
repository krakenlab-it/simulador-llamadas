"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";
import type { Conversation as ConversationInstance } from "@elevenlabs/client";
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
  onUserTranscript?: (text: string) => void;
  onFallback?: (reason?: string) => void;
}

export interface UseConvaiConnectionResult {
  connected: boolean;
  agentSpeaking: boolean;
  failed: boolean;
  disconnect: () => void;
  /** Barge-in: interrupt agent playback and signal ConvAI. */
  interrupt: () => void;
}

export function useConvaiConnection(
  options: UseConvaiConnectionOptions,
): UseConvaiConnectionResult {
  const {
    sessionUsageId,
    clientName,
    scenarioContext,
    enabled,
    onAgentTranscript,
    onUserTranscript,
    onFallback,
  } = options;

  const [connected, setConnected] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);

  const conversationRef = useRef<ConversationInstance | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const connectAttemptRef = useRef(0);
  const failedRef = useRef(false);

  const onAgentTranscriptRef = useRef(onAgentTranscript);
  const onUserTranscriptRef = useRef(onUserTranscript);
  const onFallbackRef = useRef(onFallback);

  useEffect(() => {
    onAgentTranscriptRef.current = onAgentTranscript;
    onUserTranscriptRef.current = onUserTranscript;
    onFallbackRef.current = onFallback;
  }, [onAgentTranscript, onUserTranscript, onFallback]);

  const markFailed = useCallback((reason?: string) => {
    if (failedRef.current) return;
    failedRef.current = true;
    setFailed(true);
    onFallbackRef.current?.(reason);
  }, []);

  const disconnect = useCallback(() => {
    connectAttemptRef.current += 1;
    inFlightRef.current?.abort();
    inFlightRef.current = null;

    const conversation = conversationRef.current;
    conversationRef.current = null;
    if (conversation) {
      void conversation.endSession().catch(() => undefined);
    }

    setConnected(false);
    setAgentSpeaking(false);
  }, []);

  const interrupt = useCallback(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.sendUserActivity();
  }, []);

  useEffect(() => {
    if (!enabled || !sessionUsageId || failedRef.current) {
      return;
    }

    const abort = new AbortController();
    inFlightRef.current = abort;
    const attempt = ++connectAttemptRef.current;

    void (async () => {
      try {
        const result = await startConvaiSession(
          { sessionUsageId, clientName, scenarioContext },
          abort.signal,
        );

        if (abort.signal.aborted || attempt !== connectAttemptRef.current) {
          return;
        }

        if (result.fallbackToBrowser || !result.signedUrl) {
          markFailed(result.reason);
          return;
        }

        const conversation = await Conversation.startSession({
          signedUrl: result.signedUrl,
          connectionType: "websocket",
          onConnect: () => {
            if (!abort.signal.aborted) setConnected(true);
          },
          onDisconnect: () => {
            setConnected(false);
            setAgentSpeaking(false);
            conversationRef.current = null;
          },
          onMessage: ({ message, source, role }) => {
            if (source === "user" || role === "user") {
              onUserTranscriptRef.current?.(message);
              return;
            }
            onAgentTranscriptRef.current?.(message);
          },
          onModeChange: ({ mode }) => {
            setAgentSpeaking(mode === "speaking");
          },
          onError: () => {
            if (!abort.signal.aborted) {
              markFailed("convai_session_error");
            }
          },
        });

        if (abort.signal.aborted || attempt !== connectAttemptRef.current) {
          await conversation.endSession().catch(() => undefined);
          return;
        }

        conversationRef.current = conversation;
      } catch {
        if (!abort.signal.aborted) {
          markFailed("convai_connect_failed");
        }
      } finally {
        if (inFlightRef.current === abort) {
          inFlightRef.current = null;
        }
      }
    })();

    return () => {
      abort.abort();
      disconnect();
    };
  }, [
    enabled,
    sessionUsageId,
    clientName,
    scenarioContext,
    disconnect,
    markFailed,
  ]);

  return { connected, agentSpeaking, failed, disconnect, interrupt };
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
