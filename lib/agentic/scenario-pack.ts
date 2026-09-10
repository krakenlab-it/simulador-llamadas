import type { ScenarioConfig } from "@/lib/scenarios/types";
import type {
  ScenarioPack,
  ScenarioPackMetadata,
  ScenarioPackSnippet,
} from "./types";

const FORBIDDEN_CLAIMS = [
  "garantía de resultados",
  "100% de éxito",
  "sin riesgo alguno",
  "mejor precio del mercado",
];

const MAX_SNIPPETS = 24;

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

function pushSnippet(
  snippets: ScenarioPackSnippet[],
  seen: Set<string>,
  text: string,
  source: ScenarioPackSnippet["source"],
): void {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 12) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  snippets.push({
    id: `snippet-${snippets.length + 1}`,
    text: trimmed,
    source,
  });
}

function buildSnippets(
  fieldFacts: string[],
  roundTexts: string[],
  contextText: string,
): ScenarioPackSnippet[] {
  const snippets: ScenarioPackSnippet[] = [];
  const seen = new Set<string>();

  for (const sentence of splitSentences(contextText)) {
    pushSnippet(snippets, seen, sentence, "context");
  }

  for (const fact of fieldFacts) {
    pushSnippet(snippets, seen, fact, "field");
    for (const sentence of splitSentences(fact)) {
      pushSnippet(snippets, seen, sentence, "field");
    }
  }

  for (const roundText of roundTexts) {
    pushSnippet(snippets, seen, roundText, "round");
    for (const sentence of splitSentences(roundText)) {
      pushSnippet(snippets, seen, sentence, "round");
    }
  }

  return snippets.slice(0, MAX_SNIPPETS);
}

/**
 * Builds a grounded knowledge pack from scenario config and optional context text.
 */
export function buildScenarioPack(
  config: ScenarioConfig,
  scenarioContextText = "",
  metadata: ScenarioPackMetadata = {},
): ScenarioPack {
  const contextText = (
    scenarioContextText ||
    config.agentic?.scenarioContextText ||
    ""
  ).trim();

  const companyContext = metadata.companyContext?.trim() ?? "";
  const clientTitle = metadata.clientTitle?.trim() ?? "";

  const roundTexts = config.rounds.flatMap((round) =>
    [
      round.label,
      round.goal,
      round.clientPrompt,
      round.whatGoodLooksLike,
      round.positiveCriteria.length
        ? `Criterios positivos: ${round.positiveCriteria.join(", ")}`
        : "",
      round.negativeCriteria.length
        ? `Criterios negativos: ${round.negativeCriteria.join(", ")}`
        : "",
    ].filter((part): part is string => Boolean(part)),
  );

  const fieldFacts = uniqueStrings([
    companyContext ? `Empresa: ${companyContext}` : "",
    clientTitle ? `Cargo: ${clientTitle}` : "",
    metadata.clientName ? `Cliente: ${metadata.clientName}` : "",
    config.industry,
    config.clientProblem,
    config.productSold,
    config.temperament,
    config.winCriteria,
    ...config.globalPositiveCriteria,
    ...config.openingLines,
  ]).filter(Boolean);

  const facts = uniqueStrings([
    ...fieldFacts,
    ...splitSentences(contextText),
  ]).filter(Boolean);

  const objections = uniqueStrings([
    ...config.objections,
    ...config.rounds.flatMap((round) => round.negativeCriteria),
  ]).filter(Boolean);

  return {
    facts,
    objections,
    product: config.productSold,
    winCriteria: config.winCriteria,
    companyContext,
    clientTitle,
    industry: config.industry,
    temperament: config.temperament,
    forbiddenClaims: FORBIDDEN_CLAIMS,
    snippets: buildSnippets(fieldFacts, roundTexts, contextText),
    contextText,
  };
}
