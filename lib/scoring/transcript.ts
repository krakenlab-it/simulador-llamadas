import type { TranscriptLine } from "./types";

export interface TurnTranscriptInput {
  utterance: string;
  clientReply?: string;
  roundLabel?: string;
}

export function buildTranscriptFromTurns(
  turns: TurnTranscriptInput[],
  openingClientLine?: string,
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let clock = 0;

  if (openingClientLine) {
    lines.push({ role: "client", text: openingClientLine, timestampSeconds: clock });
    clock += estimateLineDuration(openingClientLine);
  }

  for (const turn of turns) {
    lines.push({
      role: "trainee",
      text: turn.utterance,
      timestampSeconds: clock,
    });
    clock += estimateLineDuration(turn.utterance);

    if (turn.clientReply) {
      lines.push({
        role: "client",
        text: turn.clientReply,
        timestampSeconds: clock,
      });
      clock += estimateLineDuration(turn.clientReply);
    }
  }

  return lines;
}

function estimateLineDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 2.5));
}

export function traineeTextFromTranscript(lines: TranscriptLine[]): string {
  return lines
    .filter((l) => l.role === "trainee")
    .map((l) => l.text)
    .join("\n");
}

export function transcriptHasObjection(lines: TranscriptLine[]): boolean {
  const clientText = lines
    .filter((l) => l.role === "client")
    .map((l) => l.text)
    .join(" ");
  return /\b(caro|tiempo|no me interesa|ya tengo|no confío|no califica|presupuesto|ocupado)\b/i.test(
    clientText,
  );
}

export function extractQuote(text: string, maxLen = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : maxLen)}…`;
}
