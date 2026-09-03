"use client";

import {
  voiceConsoleSummary,
  type VoiceConsoleEntry,
} from "@/lib/voice/console-log";

interface VoiceConsoleLogProps {
  entries: VoiceConsoleEntry[];
}

export function VoiceConsoleLog({ entries }: VoiceConsoleLogProps) {
  const visible = entries.slice(-4);

  return (
    <div className="call-console__log" aria-label="Registro de voz">
      <p className="call-console__log-label">Consola de voz</p>
      {visible.length === 0 ? (
        <p className="call-console__log-empty">Sin eventos de voz todavía</p>
      ) : (
        <ol className="call-console__log-list">
          {visible.map((entry, index) => (
            <li
              key={`${entry.event}-${entry.at}-${index}`}
              className="call-console__log-item"
            >
              <span className="call-console__log-event">{entry.event}</span>
              <span className="call-console__log-summary">
                {voiceConsoleSummary(entry)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
