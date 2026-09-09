import type { GroundingResult, ScenarioPack } from "./types";

const NUMBER_PATTERN =
  /\b(?:\$|USD|MXN|€)?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:%|usd|mxn|pesos|dólares|euros)?\b/gi;

function normalizeNumberToken(token: string): string {
  return token.replace(/\s+/g, "").toLowerCase();
}

function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_PATTERN) ?? [];
  return [...new Set(matches.map(normalizeNumberToken))];
}

function allowedNumbersFromPack(pack: ScenarioPack): Set<string> {
  const corpus = [
    pack.product,
    pack.winCriteria,
    ...pack.facts,
    ...pack.snippets.map((snippet) => snippet.text),
    pack.contextText,
  ].join(" ");
  return new Set(extractNumbers(corpus));
}

function capitalizedWords(text: string): string[] {
  const stopwords = new Set([
    "entiendo",
    "mire",
    "bueno",
    "claro",
    "perfecto",
    "gracias",
    "hola",
    "si",
    "sí",
  ]);
  const matches = text.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? [];
  return [...new Set(matches.filter((word) => !stopwords.has(word.toLowerCase())))];
}

function allowedNames(pack: ScenarioPack, clientName: string): Set<string> {
  const names = capitalizedWords(
    [clientName, ...pack.facts, ...pack.snippets.map((s) => s.text)].join(" "),
  );
  return new Set(names.map((name) => name.toLowerCase()));
}

/**
 * Returns top snippets matching the trainee utterance (simple keyword overlap).
 */
export function retrieveTopSnippets(
  pack: ScenarioPack,
  query: string,
  limit = 3,
): string[] {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 4);

  if (tokens.length === 0) {
    return pack.snippets.slice(0, limit).map((snippet) => snippet.text);
  }

  const scored = pack.snippets
    .map((snippet) => {
      const lower = snippet.text.toLowerCase();
      const score = tokens.reduce(
        (sum, token) => sum + (lower.includes(token) ? 1 : 0),
        0,
      );
      return { text: snippet.text, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return pack.snippets.slice(0, limit).map((snippet) => snippet.text);
  }

  return scored.slice(0, limit).map((entry) => entry.text);
}

/**
 * Rejects replies that invent prices/numbers or proper names not present in the pack.
 */
export function checkReplyGrounding(
  reply: string,
  pack: ScenarioPack,
  clientName: string,
): GroundingResult {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty_reply" };
  }

  const allowedNumbers = allowedNumbersFromPack(pack);
  const replyNumbers = extractNumbers(trimmed);
  for (const number of replyNumbers) {
    if (!allowedNumbers.has(number)) {
      return { ok: false, reason: "invented_number" };
    }
  }

  const allowed = allowedNames(pack, clientName);
  const replyNames = capitalizedWords(trimmed).filter(
    (name) => name.toLowerCase() !== clientName.split(" ")[0]?.toLowerCase(),
  );
  for (const name of replyNames) {
    if (!allowed.has(name.toLowerCase())) {
      return { ok: false, reason: "invented_name" };
    }
  }

  const lower = trimmed.toLowerCase();
  for (const forbidden of pack.forbiddenClaims) {
    if (lower.includes(forbidden.toLowerCase())) {
      return { ok: false, reason: "forbidden_claim" };
    }
  }

  return { ok: true };
}
