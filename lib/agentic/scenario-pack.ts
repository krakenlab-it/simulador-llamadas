import type { ScenarioConfig } from "@/lib/scenarios/types";
import type { ScenarioPack, ScenarioPackSnippet } from "./types";

const FORBIDDEN_CLAIMS = [
  "garantía de resultados",
  "100% de éxito",
  "sin riesgo alguno",
  "mejor precio del mercado",
];

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

function buildSnippets(
  facts: string[],
  contextText: string,
): ScenarioPackSnippet[] {
  const contextSentences = splitSentences(contextText);
  const combined = uniqueStrings([...contextSentences, ...facts, ...splitSentences(contextText)]);
  return combined.slice(0, 12).map((text, index) => ({
    id: `snippet-${index + 1}`,
    text,
    source: contextSentences.includes(text) ? "context" : "scenario",
  }));
}

/**
 * Builds a grounded knowledge pack from scenario config and optional context text.
 */
export function buildScenarioPack(
  config: ScenarioConfig,
  scenarioContextText = "",
): ScenarioPack {
  const contextText = (
    scenarioContextText ||
    config.agentic?.scenarioContextText ||
    ""
  ).trim();

  const facts = uniqueStrings([
    config.clientProblem,
    config.productSold,
    config.industry,
    config.temperament,
    ...config.globalPositiveCriteria,
    ...config.openingLines,
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
    forbiddenClaims: FORBIDDEN_CLAIMS,
    snippets: buildSnippets(facts, contextText),
    contextText,
  };
}
