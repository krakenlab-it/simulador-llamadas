import type { CallAnalytics, TranscriptLine } from "./types";

const OPEN_QUESTION =
  /(?:¿\s*)?(qué|que|como|cómo|cuál|cual|cuáles|cuales|por qué|por que|para qué|para que|dónde|donde|quién|quien|cuánto|cuanto|cuánta|cuanta|cuántos|cuantos|cuántas|cuantas)/iu;
const CLOSED_QUESTION = /\b(sí o no|verdad|cierto|¿tiene|¿hay|¿es|¿está|¿puede|¿podría)\b/i;
const CLARIFYING_QUESTION =
  /\b(ayúdeme a entender|explíqueme|cuénteme más|qué quiere decir|a qué se refiere)\b/i;

const NEXT_STEP_PATTERN =
  /\b(envío|enviaré|agendamos|agendemos|quedamos|le mando|le llamo|demo|propuesta|siguiente paso|martes|miércoles|jueves|viernes|lunes|mañana|a las \d)\b/i;

const WORDS_PER_SECOND = 2.5;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateSeconds(words: number): number {
  return Math.round(words / WORDS_PER_SECOND);
}

export function countQuestionTypes(text: string): CallAnalytics["questionTypes"] {
  const questionChunks = text.match(/[^.!?]*\?+/g) ?? [];
  let open = 0;
  let closed = 0;
  let clarifying = 0;

  for (const chunk of questionChunks) {
    if (CLARIFYING_QUESTION.test(chunk)) {
      clarifying += 1;
    } else if (OPEN_QUESTION.test(chunk)) {
      open += 1;
    } else if (CLOSED_QUESTION.test(chunk) || chunk.includes("?")) {
      closed += 1;
    }
  }

  return { open, closed, clarifying };
}

export function detectNextStep(text: string): boolean {
  return NEXT_STEP_PATTERN.test(text);
}

export function computeLongestMonologueSeconds(
  lines: TranscriptLine[],
  role: "trainee" | "client" = "trainee",
): number {
  let longest = 0;
  let currentWords = 0;

  for (const line of lines) {
    if (line.role === role) {
      currentWords += countWords(line.text);
    } else if (currentWords > 0) {
      longest = Math.max(longest, estimateSeconds(currentWords));
      currentWords = 0;
    }
  }

  if (currentWords > 0) {
    longest = Math.max(longest, estimateSeconds(currentWords));
  }

  return longest;
}

export function computeTalkPercent(lines: TranscriptLine[]): number {
  const traineeWords = lines
    .filter((l) => l.role === "trainee")
    .reduce((sum, l) => sum + countWords(l.text), 0);
  const clientWords = lines
    .filter((l) => l.role === "client")
    .reduce((sum, l) => sum + countWords(l.text), 0);
  const total = traineeWords + clientWords;
  if (total === 0) return 0;
  return Math.round((traineeWords / total) * 100);
}

export function computePatienceAfterBuyerTurn(
  lines: TranscriptLine[],
): number | null {
  for (let i = lines.length - 2; i >= 0; i -= 1) {
    if (lines[i].role === "client" && lines[i + 1]?.role === "trainee") {
      const clientTs = lines[i].timestampSeconds;
      const traineeTs = lines[i + 1].timestampSeconds;
      if (clientTs !== undefined && traineeTs !== undefined) {
        return Math.max(0, traineeTs - clientTs);
      }
      const traineeWords = countWords(lines[i + 1].text);
      return estimateSeconds(Math.max(1, Math.floor(traineeWords / 3)));
    }
  }
  return null;
}

export function computeCallAnalytics(lines: TranscriptLine[]): CallAnalytics {
  const traineeText = lines
    .filter((l) => l.role === "trainee")
    .map((l) => l.text)
    .join(" ");

  return {
    talkPercent: computeTalkPercent(lines),
    longestMonologueSeconds: computeLongestMonologueSeconds(lines, "trainee"),
    questionTypes: countQuestionTypes(traineeText),
    patienceAfterBuyerTurnSeconds: computePatienceAfterBuyerTurn(lines),
    hasNextStep: detectNextStep(traineeText),
  };
}

export function computeTurnAnalytics(input: {
  utterance: string;
  priorLines: TranscriptLine[];
}): CallAnalytics {
  const lines: TranscriptLine[] = [
    ...input.priorLines,
    { role: "trainee", text: input.utterance },
  ];
  return computeCallAnalytics(lines);
}
