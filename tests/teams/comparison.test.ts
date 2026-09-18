import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addMember,
  createTeam,
  createTeamTest,
  generateTeamComparison,
  recordResult,
  resetTeamMemory,
} from "@/lib/teams";

const savedDatabaseUrl = process.env.DATABASE_URL;

describe("same-test team comparison", () => {
  beforeEach(() => {
    resetTeamMemory();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDatabaseUrl;
  });

  it("creates a team, members, one shared exam and compares scores", async () => {
    const team = await createTeam({ name: "Jaime / pasantes" });
    const jaime = await addMember(team.id, { displayName: "Jaime" });
    const ana = await addMember(team.id, { displayName: "Ana" });
    const test = await createTeamTest(team.id, { scenarioSlug: "mariana" });

    await recordResult(test.id, {
      memberId: jaime.id,
      totalScore: 82,
      won: true,
      turnsCompleted: 5,
    });
    await recordResult(test.id, {
      memberId: ana.id,
      totalScore: 54,
      won: false,
      turnsCompleted: 5,
    });

    const comparison = await generateTeamComparison(team.id, test.id);
    expect(comparison.leaderName).toBe("Jaime");
    expect(comparison.members).toHaveLength(2);
    expect(comparison.narrative).toMatch(/Jaime/);
    expect(comparison.gaps.some((gap) => /28 puntos|Ana/i.test(gap))).toBe(true);
    expect(comparison.coaching.join(" ")).toMatch(/caseta/i);
  });
});
