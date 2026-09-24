import { buildDeterministicComparison } from "./comparison";
import {
  findTest,
  getTeamSnapshot,
  listResults,
  TeamStoreError,
} from "./store";
import type { TeamComparisonView } from "@/lib/agent/types";

export async function generateTeamComparison(
  teamId: string,
  testId: string,
): Promise<TeamComparisonView> {
  const snapshot = await getTeamSnapshot(teamId);
  const test = await findTest(testId);
  if (!test || test.teamId !== teamId) {
    throw new TeamStoreError("Examen no encontrado en este equipo.");
  }
  const results = await listResults(testId);
  const members = snapshot.members.map((member) => {
    const result = results.find((item) => item.memberId === member.id);
    return {
      memberId: member.id,
      displayName: member.displayName,
      totalScore: result?.totalScore ?? 0,
      won: result?.won ?? false,
      turnsCompleted: result?.turnsCompleted ?? 0,
    };
  });

  return buildDeterministicComparison({
    teamName: snapshot.team.name,
    teamId,
    testId,
    scenarioSlug: test.scenarioSlug,
    title: test.title,
    members,
  });
}
