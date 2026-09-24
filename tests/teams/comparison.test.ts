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
    expect(comparison.coaching.join(" ")).toMatch(/local/i);
  });

  it("does not count a teammate without a score as zero", async () => {
    const team = await createTeam({ name: "Piso" });
    const jaime = await addMember(team.id, { displayName: "Jaime" });
    await addMember(team.id, { displayName: "Ana" });
    const test = await createTeamTest(team.id, { scenarioSlug: "mariana" });
    await recordResult(test.id, {
      memberId: jaime.id,
      totalScore: 82,
      won: true,
      turnsCompleted: 5,
    });

    const comparison = await generateTeamComparison(team.id, test.id);
    expect(comparison.members).toHaveLength(1);
    expect(comparison.members[0]?.totalScore).toBe(82);
    expect(comparison.narrative).toMatch(/Ana/);
    expect(comparison.narrative).not.toMatch(/0 pts/);
    expect(comparison.gaps.join(" ")).toMatch(/no cuenta como cero/i);
  });

  it("rejects a score that is not a number between 0 and 100", async () => {
    const team = await createTeam({ name: "Piso" });
    const jaime = await addMember(team.id, { displayName: "Jaime" });
    const test = await createTeamTest(team.id, { scenarioSlug: "mariana" });
    await expect(
      recordResult(test.id, { memberId: jaime.id, totalScore: Number.NaN }),
    ).rejects.toThrow(/0 y 100/);
    await expect(
      recordResult(test.id, { memberId: jaime.id, totalScore: 140 }),
    ).rejects.toThrow(/0 y 100/);
  });
});
