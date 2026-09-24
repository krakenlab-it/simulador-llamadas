import {
  buildDeterministicComparison,
  splitComparisonMembers,
} from "./comparison";
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
  const { recorded, pendingNames } = splitComparisonMembers(
    snapshot.members,
    results,
  );

  return buildDeterministicComparison({
    teamName: snapshot.team.name,
    teamId,
    testId,
    scenarioSlug: test.scenarioSlug,
    title: test.title,
    pendingNames,
    members: recorded,
  });
}
