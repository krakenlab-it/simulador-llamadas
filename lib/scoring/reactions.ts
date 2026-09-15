import type { RoundType } from "@/lib/db/types";
import type { ClientReaction } from "./rondas";
import {
  DEFAULT_REACTION_BANKS,
  SCENARIO_REACTION_BANKS,
} from "./reaction-banks";
import {
  pickVariedLine,
  priorClientTexts,
} from "@/lib/simulation/session-variation";

export interface ClientReplyOptions {
  sessionSeed?: string;
  turnNumber?: number;
  priorLines?: readonly { role: string; text: string }[];
}

/**
 * Legacy single-line map (first variant per tier) for backwards compatibility.
 */
export const SCENARIO_REACTIONS: Record<
  string,
  Partial<Record<RoundType, Record<ClientReaction, string>>>
> = Object.fromEntries(
  Object.entries(SCENARIO_REACTION_BANKS).map(([slug, rounds]) => [
    slug,
    Object.fromEntries(
      Object.entries(rounds).map(([roundType, reactions]) => [
        roundType,
        Object.fromEntries(
          Object.entries(reactions).map(([reaction, lines]) => [
            reaction,
            lines[0],
          ]),
        ),
      ]),
    ),
  ]),
);

const DEFAULT_REACTIONS: Record<RoundType, Record<ClientReaction, string>> =
  Object.fromEntries(
    Object.entries(DEFAULT_REACTION_BANKS).map(([roundType, reactions]) => [
      roundType,
      Object.fromEntries(
        Object.entries(reactions).map(([reaction, lines]) => [reaction, lines[0]]),
      ),
    ]),
  ) as Record<RoundType, Record<ClientReaction, string>>;

function reactionPool(
  scenarioSlug: string,
  roundType: RoundType,
  reaction: ClientReaction,
): readonly string[] {
  return (
    SCENARIO_REACTION_BANKS[scenarioSlug]?.[roundType]?.[reaction] ??
    DEFAULT_REACTION_BANKS[roundType][reaction]
  );
}

export function getClientReply(
  scenarioSlug: string,
  roundType: RoundType,
  reaction: ClientReaction,
  options?: ClientReplyOptions,
): string {
  const pool = reactionPool(scenarioSlug, roundType, reaction);
  const sessionSeed = options?.sessionSeed?.trim();
  if (!sessionSeed) {
    return pool[0] ?? DEFAULT_REACTIONS[roundType][reaction];
  }

  const salt = `${roundType}:${options?.turnNumber ?? 0}:${reaction}`;
  return pickVariedLine(pool, {
    sessionSeed,
    salt,
    priorClientLines: priorClientTexts(options?.priorLines ?? []),
  });
}
