import { generateTeamComparison, listTeams } from "@/lib/teams";
import type { z } from "zod";
import type { compareTeamTestSchema } from "./tools";
import type { AgentToolSession } from "./types";

export async function executeListTeams(): Promise<{
  ok: boolean;
  summary: string;
  teams: Array<{ id: string; name: string }>;
}> {
  const teams = await listTeams();
  return {
    ok: true,
    summary:
      teams.length === 0
        ? "No hay equipos todavía."
        : `${teams.length} equipo(s): ${teams.map((team) => team.name).join(", ")}`,
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
  };
}

export async function executeCompareTeamTest(
  session: AgentToolSession,
  input: z.infer<typeof compareTeamTestSchema>,
): Promise<{ ok: boolean; summary: string; error?: string }> {
  try {
    const comparison = await generateTeamComparison(input.teamId, input.testId);
    session.comparison = comparison;
    return { ok: true, summary: comparison.narrative };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo comparar.";
    return { ok: false, summary: message, error: message };
  }
}
