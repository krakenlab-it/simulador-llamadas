import type { PracticeMode, RoundType } from "@/lib/db/types";
import type { ClientReaction } from "./rondas";
import {
  DEFAULT_REACTION_BANKS,
  SCENARIO_REACTION_BANKS,
} from "./reaction-banks";
import {
  DATE_DEMAND_AFTER_ACCEPT,
  EMAIL_COLLABORATION_LINES,
  meetingAcceptedFromPriorLines,
} from "@/lib/agentic/meeting-logistics";
import {
  pickVariedLine,
  priorClientTexts,
} from "@/lib/simulation/session-variation";

export interface ClientReplyOptions {
  sessionSeed?: string;
  turnNumber?: number;
  priorLines?: readonly { role: string; text: string }[];
  channel?: PracticeMode;
}

const VOICE_WRITE_FORBIDDEN =
  /puede escribir|máximo un párrafo|mande un párrafo|por escrito ahora|envíe un pdf|mande un pdf|adjunte un pdf/i;

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
  let pool = reactionPool(scenarioSlug, roundType, reaction);
  if (options?.channel === "voz") {
    pool = pool.filter((line) => !VOICE_WRITE_FORBIDDEN.test(line));
    if (pool.length === 0) {
      pool = [
        "Dígamelo en una frase, no tengo tiempo para correos ahorita.",
        "En el teléfono no reviso correo; resúmalo en voz alta.",
        "No mande nada por escrito ahorita; vaya al punto.",
      ];
    }
  }

  if (meetingAcceptedFromPriorLines(options?.priorLines)) {
    pool = pool.filter((line) => !DATE_DEMAND_AFTER_ACCEPT.test(line));
    if (pool.length === 0) {
      pool = [...EMAIL_COLLABORATION_LINES];
    }
  }

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
