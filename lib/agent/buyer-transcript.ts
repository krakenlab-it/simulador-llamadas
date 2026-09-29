import type { ConversationTurn } from "@/lib/agent/client-motor";
import type { TranscriptLine } from "@/lib/scoring/types";

function normalizeLine(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Ensures the spoken pickup line is in memory before turn scoring. */
export function withCallOpeningInTranscript(
  priorLines: readonly TranscriptLine[],
  openingLine: string | undefined,
): TranscriptLine[] {
  const opening = openingLine?.trim();
  if (!opening) return [...priorLines];
  const norm = normalizeLine(opening);
  const already = priorLines.some(
    (line) => line.role === "client" && normalizeLine(line.text) === norm,
  );
  if (already) return [...priorLines];
  return [{ role: "client", text: opening }, ...priorLines];
}

export function conversationTurnsFromTranscript(
  lines: readonly TranscriptLine[],
): ConversationTurn[] {
  return lines
    .filter((line) => line.role === "client" || line.role === "trainee")
    .map((line) => ({
      role: line.role === "client" ? "client" : "trainee",
      text: line.text,
    }));
}

export type BuyerChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Multi-turn history for the buyer model: user = vendedor, assistant = cliente.
 */
export function buildBuyerChatMessages(
  priorTurns: readonly ConversationTurn[],
  traineeUtterance: string,
): BuyerChatMessage[] {
  const messages: BuyerChatMessage[] = [];
  for (const turn of priorTurns) {
    if (turn.role === "trainee") {
      messages.push({ role: "user", content: turn.text });
    } else {
      messages.push({ role: "assistant", content: turn.text });
    }
  }
  messages.push({ role: "user", content: traineeUtterance });
  return messages;
}

export function formatTranscriptBlock(
  priorTurns: readonly ConversationTurn[],
  traineeUtterance: string,
  maxLines = 14,
): string {
  const rows: string[] = [];
  for (const turn of priorTurns.slice(-maxLines)) {
    const label = turn.role === "trainee" ? "Vendedor" : "Cliente";
    rows.push(`${label}: ${turn.text}`);
  }
  rows.push(`Vendedor: ${traineeUtterance}`);
  return rows.join("\n");
}

export function isNearDuplicateReply(
  candidate: string,
  recentReplies: readonly string[],
): boolean {
  const norm = normalizeLine(candidate);
  if (!norm) return true;
  return recentReplies.some((item) => {
    const other = normalizeLine(item);
    if (!other) return false;
    if (other === norm) return true;
    if (norm.length > 12 && other.length > 12) {
      return norm.includes(other) || other.includes(norm);
    }
    return false;
  });
}
