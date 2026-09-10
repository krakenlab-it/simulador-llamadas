import type { DifficultyLevel } from "@/lib/db/types";
import {
  PAIN_TEMPLATES,
  RECEIVER_INDUSTRIES,
  RECEIVER_ROLES,
} from "./persona-pools";
import { fullScenarioContextText } from "./scenario-context";
import { SeededRng } from "./seed";
import type { DialogueTypeConfig, KrakenLabCohortConfig } from "./types";

const MIN_RICH_CONTEXT_CHARS = 40;

function normalizeHint(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function scorePhraseAgainstCorpus(phrase: string, corpus: string): number {
  const normalizedCorpus = normalizeHint(corpus);
  const tokens = normalizeHint(phrase)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  return tokens.reduce(
    (score, token) => score + (normalizedCorpus.includes(token) ? 1 : 0),
    0,
  );
}

function pickBestFromPool<T extends string>(
  pool: readonly T[],
  corpus: string,
  rng: SeededRng,
): T {
  const ranked = pool
    .map((entry) => ({ entry, score: scorePhraseAgainstCorpus(entry, corpus) }))
    .sort((a, b) => b.score - a.score);
  const bestScore = ranked[0]?.score ?? 0;
  if (bestScore <= 0) return rng.pick(pool);
  const top = ranked.filter((entry) => entry.score === bestScore).map((entry) => entry.entry);
  return rng.pick(top);
}

export function buildDialogueCorpus(
  cohort: Pick<
    KrakenLabCohortConfig,
    "scenarioContext" | "dialogueTypes" | "roleObjective"
  >,
): string {
  const parts = [
    fullScenarioContextText(cohort.scenarioContext),
    cohort.roleObjective?.trim() ?? "",
    ...cohort.dialogueTypes.flatMap((dialogue) => [
      dialogue.productServiceExplanation,
      dialogue.simulationContext,
      dialogue.realObjective,
    ]),
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function hasRichScenarioContext(corpus: string): boolean {
  return corpus.trim().length >= MIN_RICH_CONTEXT_CHARS;
}

export function deriveIndustryFromCorpus(corpus: string, rng: SeededRng): string {
  return pickBestFromPool(RECEIVER_INDUSTRIES, corpus, rng);
}

export function deriveRoleFromCorpus(corpus: string, rng: SeededRng): string {
  const normalizedCorpus = normalizeHint(corpus);
  for (const role of RECEIVER_ROLES) {
    const hint = normalizeHint(role);
    if (normalizedCorpus.includes(hint)) return role;
  }
  return pickBestFromPool(RECEIVER_ROLES, corpus, rng);
}

export function extractObjectionsFromCorpus(corpus: string): string[] {
  const match = corpus.match(/objeciones?\s*[:.-]\s*([^\n]+)/i);
  if (!match?.[1]) return [];
  return uniqueStrings(
    match[1]
      .split(/[,;]| y /i)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8),
  );
}

export function derivePainPointsFromCorpus(
  corpus: string,
  rng: SeededRng,
  count: number,
): string[] {
  const candidates = uniqueStrings([
    ...extractObjectionsFromCorpus(corpus),
    ...splitSentences(corpus),
  ]).filter((sentence) => !/^objeciones?\s*:/i.test(sentence));

  const pains: string[] = [];
  const pool = candidates.length > 0 ? candidates : [...PAIN_TEMPLATES];
  const shuffled = rng.shuffle(pool);
  for (const candidate of shuffled) {
    if (pains.length >= count) break;
    if (!pains.some((pain) => pain.toLowerCase() === candidate.toLowerCase())) {
      pains.push(candidate);
    }
  }
  return pains;
}

export function deriveObjectionsForDifficulty(
  corpus: string,
  difficulty: DifficultyLevel,
  templates: Record<DifficultyLevel, string[]>,
  rng: SeededRng,
): string[] {
  const fromCorpus = extractObjectionsFromCorpus(corpus);
  if (fromCorpus.length >= 2) return fromCorpus.slice(0, 4);
  if (fromCorpus.length > 0) {
    return uniqueStrings([...fromCorpus, ...rng.pickMany(templates[difficulty], 2)]);
  }
  return [...templates[difficulty]];
}

export function deriveProductFromDialogue(
  dialogue: DialogueTypeConfig | undefined,
  corpus: string,
): string {
  const fromDialogue = dialogue?.productServiceExplanation.trim();
  if (fromDialogue) return fromDialogue;

  const productMatch = corpus.match(/producto\s*[:.-]\s*([^\n]+)/i);
  if (productMatch?.[1]) return productMatch[1].trim();

  const vendemosMatch = corpus.match(/vendemos\s+([^.!\n]+)/i);
  if (vendemosMatch?.[1]) return vendemosMatch[1].trim();

  return "";
}

export function deriveProblemFromDialogue(
  dialogue: DialogueTypeConfig | undefined,
  corpus: string,
  fallbackPain?: string,
): string {
  const fromSimulation = dialogue?.simulationContext.trim();
  if (fromSimulation) return fromSimulation;

  const fromObjective = dialogue?.realObjective.trim();
  if (fromObjective) return fromObjective;

  const problemMatch = corpus.match(/problema\s*[:.-]\s*([^\n]+)/i);
  if (problemMatch?.[1]) return problemMatch[1].trim();

  if (fallbackPain) return fallbackPain;

  const sentence = splitSentences(corpus)[0];
  return sentence ?? "operaciones diarias";
}

export function deriveCompanyLabel(
  corpus: string,
  industry: string,
  city: string,
): string {
  const empresaMatch = corpus.match(/empresa\s*[:.-]\s*([^\n]+)/i);
  if (empresaMatch?.[1]) return empresaMatch[1].trim();

  const clientMatch = corpus.match(/cliente\s*:\s*([^(·\n]+)/i);
  if (clientMatch?.[1]) {
    const tail = clientMatch[1].split("·")[0]?.trim();
    if (tail) return tail;
  }

  return `${industry} ${city.split(" ")[0]}`;
}

export function corpusKeywordOverlap(corpus: string, values: string[]): number {
  const normalized = normalizeHint(corpus);
  const keywords = normalizeHint(values.join(" "))
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5);
  if (keywords.length === 0) return 0;
  const hits = keywords.filter((token) => normalized.includes(token)).length;
  return hits / keywords.length;
}

export function hasMinimumKrakenAgenticGrounding(
  cohort: Pick<
    KrakenLabCohortConfig,
    "scenarioContext" | "dialogueTypes" | "roleObjective"
  >,
): boolean {
  const corpus = buildDialogueCorpus(cohort);
  if (hasRichScenarioContext(corpus)) return true;
  const dialogue = cohort.dialogueTypes[0];
  const product = dialogue?.productServiceExplanation?.trim();
  const problem =
    dialogue?.simulationContext?.trim() ||
    dialogue?.realObjective?.trim() ||
    cohort.roleObjective?.trim();
  return Boolean(product && problem);
}
