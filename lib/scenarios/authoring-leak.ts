import type { ScenarioConfig } from "./types";

/** Coach-only snippets that must never be spoken verbatim by the live client. */
export function collectAuthoringLeakPhrases(
  config: ScenarioConfig | null | undefined,
): string[] {
  if (!config) return [];
  const phrases: string[] = [];
  const pushChunk = (text: string | undefined) => {
    const trimmed = text?.trim();
    if (!trimmed || trimmed.length < 12) return;
    phrases.push(trimmed);
    trimmed
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 12)
      .forEach((part) => phrases.push(part));
  };

  pushChunk(config.clientProblem);
  for (const objection of config.objections ?? []) pushChunk(objection);
  pushChunk(config.winCriteria);
  for (const round of config.rounds ?? []) {
    pushChunk(round.goal);
    pushChunk(round.clientPrompt);
    pushChunk(round.whatGoodLooksLike);
  }

  return [...new Set(phrases)];
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function replyContainsAuthoringLeak(
  reply: string,
  config: ScenarioConfig | null | undefined,
): boolean {
  const normalizedReply = normalizeForCompare(reply);
  if (!normalizedReply) return false;

  for (const phrase of collectAuthoringLeakPhrases(config)) {
    const normalizedPhrase = normalizeForCompare(phrase);
    if (normalizedPhrase.length < 12) continue;
    if (normalizedReply.includes(normalizedPhrase)) return true;
    const words = normalizedPhrase.split(" ").filter((w) => w.length > 4);
    if (words.length >= 4) {
      const hitCount = words.filter((word) => normalizedReply.includes(word)).length;
      if (hitCount >= Math.min(5, words.length)) return true;
    }
  }
  return false;
}

export function sanitizeLeakedBuyerReply(
  reply: string,
  config: ScenarioConfig | null | undefined,
  language: "es" | "en" = "es",
): string {
  if (!replyContainsAuthoringLeak(reply, config)) return reply;
  return language === "en"
    ? "Sorry — who's calling? I'm tied up right now."
    : "Perdón, ¿quién habla? Estoy en otra cosa.";
}
