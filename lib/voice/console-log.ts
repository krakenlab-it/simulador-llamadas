export const VOICE_CONSOLE_MAX_ENTRIES = 8;

export type VoiceConsoleEventName = "voice.tts.attempt" | "voice.turn.submit";

export interface VoiceConsoleEntry {
  event: VoiceConsoleEventName;
  at: number;
  requestId?: string;
  httpStatus?: number;
  fallbackToBrowser?: boolean;
  failureReason?: string;
  languageCode?: string;
  recovered?: boolean;
  endpoint?: string;
  voiceIdCategory?: "library" | "premade";
  charsSent?: number;
  durationMs?: number;
  roundNumber?: number;
}

const SECRET_LIKE =
  /sk_[a-zA-Z0-9]+|Bearer\s+\S+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+|api[_-]?key/gi;

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function asEventName(value: unknown): VoiceConsoleEventName | null {
  if (value === "voice.tts.attempt" || value === "voice.turn.submit") return value;
  return null;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function asSafeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const redacted = trimmed.replace(SECRET_LIKE, "[redacted]");
  if (redacted.includes("[redacted]") && redacted.replace(/\s|\[redacted\]/g, "") === "") {
    return undefined;
  }
  return redacted;
}

function asVoiceIdCategory(value: unknown): "library" | "premade" | undefined {
  if (value === "library" || value === "premade") return value;
  return undefined;
}

export function toPublicVoiceConsoleEntry(
  raw: unknown,
  at = Date.now(),
): VoiceConsoleEntry | null {
  const input = asRecord(raw);
  if (!input) return null;
  const event = asEventName(input.event);
  if (!event) return null;

  const entry: VoiceConsoleEntry = { event, at };
  const requestId = asSafeString(input.requestId);
  const httpStatus = asFiniteNumber(input.httpStatus);
  const failureReason = asSafeString(input.failureReason);
  const languageCode = asSafeString(input.languageCode);
  const endpoint = asSafeString(input.endpoint);
  const voiceIdCategory = asVoiceIdCategory(input.voiceIdCategory);
  const charsSent = asFiniteNumber(input.charsSent);
  const durationMs = asFiniteNumber(input.durationMs);
  const roundNumber = asFiniteNumber(input.roundNumber);

  if (requestId) entry.requestId = requestId;
  if (httpStatus !== undefined) entry.httpStatus = httpStatus;
  if (typeof input.fallbackToBrowser === "boolean") {
    entry.fallbackToBrowser = input.fallbackToBrowser;
  }
  if (failureReason) entry.failureReason = failureReason;
  if (languageCode) entry.languageCode = languageCode;
  if (typeof input.recovered === "boolean") entry.recovered = input.recovered;
  if (endpoint) entry.endpoint = endpoint;
  if (voiceIdCategory) entry.voiceIdCategory = voiceIdCategory;
  if (charsSent !== undefined) entry.charsSent = charsSent;
  if (durationMs !== undefined) entry.durationMs = durationMs;
  if (roundNumber !== undefined) entry.roundNumber = roundNumber;

  return entry;
}

export function pushVoiceConsoleEntry(
  logs: readonly VoiceConsoleEntry[],
  next: VoiceConsoleEntry,
): VoiceConsoleEntry[] {
  return [...logs, next].slice(-VOICE_CONSOLE_MAX_ENTRIES);
}

export function voiceConsoleSummary(entry: VoiceConsoleEntry): string {
  switch (entry.event) {
    case "voice.tts.attempt": {
      const status = entry.httpStatus ?? "—";
      if (entry.fallbackToBrowser) {
        return `TTS ${status} · voz del navegador`;
      }
      return `TTS ${status}${entry.recovered ? " · recuperado" : ""}`;
    }
    case "voice.turn.submit": {
      const round = entry.roundNumber ? ` ronda ${entry.roundNumber}` : "";
      return `Turno${round} · ${entry.httpStatus ?? "ok"}`;
    }
    default: {
      const _exhaustive: never = entry.event;
      return _exhaustive;
    }
  }
}

export function encodePublicTtsTraceHeader(
  raw: Omit<VoiceConsoleEntry, "at" | "event"> & {
    event?: VoiceConsoleEventName;
    at?: number;
  },
): string {
  const entry = toPublicVoiceConsoleEntry({
    event: "voice.tts.attempt",
    ...raw,
  });
  return JSON.stringify(entry ?? { event: "voice.tts.attempt" });
}

export function readPublicTtsTrace(
  headers: Pick<Headers, "get">,
  httpStatus?: number,
): VoiceConsoleEntry | null {
  const raw = headers.get("X-Voice-Trace") ?? headers.get("x-voice-trace");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return toPublicVoiceConsoleEntry({
        ...parsed,
        event: "voice.tts.attempt",
        httpStatus: parsed.httpStatus ?? httpStatus,
      });
    } catch {
      // Fall through to the existing voice headers.
    }
  }

  return toPublicVoiceConsoleEntry({
    event: "voice.tts.attempt",
    requestId: headers.get("X-Voice-Request-Id") ?? headers.get("x-voice-request-id"),
    endpoint: headers.get("X-Voice-Endpoint") ?? headers.get("x-voice-endpoint"),
    httpStatus,
    fallbackToBrowser: httpStatus !== undefined && httpStatus >= 400,
  });
}

export function publicTurnSubmitTrace(input: {
  httpStatus: number;
  roundNumber?: number;
  turnId?: string;
  code?: string;
}): VoiceConsoleEntry {
  return (
    toPublicVoiceConsoleEntry({
      event: "voice.turn.submit",
      httpStatus: input.httpStatus,
      roundNumber: input.roundNumber,
      requestId: input.turnId,
      failureReason: input.code,
    }) ?? {
      event: "voice.turn.submit",
      at: Date.now(),
      httpStatus: input.httpStatus,
      roundNumber: input.roundNumber,
    }
  );
}
