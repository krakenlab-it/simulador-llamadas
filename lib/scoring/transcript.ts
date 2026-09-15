import { getClientBySlug } from "@/lib/clients";
import { openingLineForCall } from "@/lib/scenarios/authoring";
import { isClinicPreset } from "@/lib/scenarios/types";
import type { ScenarioConfig } from "@/lib/scenarios/types";
import { getClinicOpeningLine } from "@/lib/simulation/openings";
import type { TranscriptLine } from "./types";

export interface TurnTranscriptInput {
  utterance: string;
  clientReply?: string;
  roundLabel?: string;
}

/** Prepends the call opening when prior transcript lines omit the first client line. */
export function enrichPriorTranscriptLines(
  lines: TranscriptLine[],
  options: {
    isPreset: boolean;
    scenarioSlug: string;
    config: ScenarioConfig | null;
    sessionSeed: string;
  },
): TranscriptLine[] {
  if (lines.some((line) => line.role === "client")) {
    return lines;
  }

  let opening: string | undefined;
  if (options.isPreset && isClinicPreset(options.scenarioSlug)) {
    const client = getClientBySlug(options.scenarioSlug);
    if (client) {
      opening = getClinicOpeningLine(client, options.sessionSeed);
    }
  } else {
    opening = openingLineForCall(
      options.config,
      options.isPreset,
      undefined,
      options.sessionSeed,
    );
  }

  const trimmed = opening?.trim();
  if (!trimmed) return lines;
  return [{ role: "client", text: trimmed }, ...lines];
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
