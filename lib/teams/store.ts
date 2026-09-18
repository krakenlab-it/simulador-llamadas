import type { PoolClient } from "pg";
import { withPgClient } from "@/lib/session";
import {
  memoryAddMember,
  memoryCreateTeam,
  memoryCreateTest,
  memoryFindTest,
  memoryGetSnapshot,
  memoryListResults,
  memoryListTeams,
  memoryRecordResult,
  TeamStoreError,
} from "./memory";
import type {
  AddMemberInput,
  CreateTeamInput,
  CreateTestInput,
  PracticeTeam,
  PracticeTeamMember,
  PracticeTeamResult,
  PracticeTeamTest,
  RecordResultInput,
  TeamSnapshot,
} from "./types";

export { resetTeamMemory, TeamStoreError } from "./memory";

function canUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function withOptionalDb<T>(
  fn: (client: PoolClient) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!canUseDatabase()) return fallback();
  try {
    return await withPgClient(fn);
  } catch {
    return fallback();
  }
}

export async function createTeam(input: CreateTeamInput): Promise<PracticeTeam> {
  return withOptionalDb(
    async (client) => {
      const name = input.name.trim();
      if (!name) throw new TeamStoreError("El equipo necesita un nombre.");
      const { rows } = await client.query<PracticeTeam>(
        `INSERT INTO practice_teams (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, created_by AS "createdBy", created_at AS "createdAt"`,
        [name, input.createdBy ?? null],
      );
      return rows[0];
    },
    () => memoryCreateTeam(input),
  );
}

export async function listTeams(): Promise<PracticeTeam[]> {
  return withOptionalDb(
    async (client) => {
      const { rows } = await client.query<PracticeTeam>(
        `SELECT id, name, created_by AS "createdBy", created_at AS "createdAt"
         FROM practice_teams
         ORDER BY created_at DESC`,
      );
      return rows;
    },
    () => memoryListTeams(),
  );
}

export async function getTeamSnapshot(teamId: string): Promise<TeamSnapshot> {
  return withOptionalDb(
    async (client) => {
      const team = await client.query<PracticeTeam>(
        `SELECT id, name, created_by AS "createdBy", created_at AS "createdAt"
         FROM practice_teams WHERE id = $1`,
        [teamId],
      );
      if (!team.rows[0]) throw new TeamStoreError("Equipo no encontrado.");
      const members = await client.query<PracticeTeamMember>(
        `SELECT id, team_id AS "teamId", display_name AS "displayName",
                email, created_at AS "createdAt"
         FROM practice_team_members WHERE team_id = $1 ORDER BY created_at`,
        [teamId],
      );
      const tests = await client.query<PracticeTeamTest>(
        `SELECT id, team_id AS "teamId", scenario_slug AS "scenarioSlug",
                title, created_at AS "createdAt"
         FROM practice_team_tests WHERE team_id = $1 ORDER BY created_at DESC`,
        [teamId],
      );
      return {
        team: team.rows[0],
        members: members.rows,
        tests: tests.rows,
      };
    },
    () => memoryGetSnapshot(teamId),
  );
}

export async function addMember(
  teamId: string,
  input: AddMemberInput,
): Promise<PracticeTeamMember> {
  return withOptionalDb(
    async (client) => {
      await getTeamSnapshot(teamId);
      const displayName = input.displayName.trim();
      if (!displayName) throw new TeamStoreError("El miembro necesita un nombre.");
      const { rows } = await client.query<PracticeTeamMember>(
        `INSERT INTO practice_team_members (team_id, display_name, email)
         VALUES ($1, $2, $3)
         RETURNING id, team_id AS "teamId", display_name AS "displayName",
                   email, created_at AS "createdAt"`,
        [teamId, displayName, input.email?.trim().toLowerCase() || null],
      );
      return rows[0];
    },
    () => memoryAddMember(teamId, input),
  );
}

export async function createTeamTest(
  teamId: string,
  input: CreateTestInput,
): Promise<PracticeTeamTest> {
  return withOptionalDb(
    async (client) => {
      await getTeamSnapshot(teamId);
      const scenarioSlug = input.scenarioSlug.trim();
      if (!scenarioSlug) throw new TeamStoreError("El examen necesita un escenario.");
      const title = input.title?.trim() || `Mismo examen · ${scenarioSlug}`;
      const { rows } = await client.query<PracticeTeamTest>(
        `INSERT INTO practice_team_tests (team_id, scenario_slug, title)
         VALUES ($1, $2, $3)
         RETURNING id, team_id AS "teamId", scenario_slug AS "scenarioSlug",
                   title, created_at AS "createdAt"`,
        [teamId, scenarioSlug, title],
      );
      return rows[0];
    },
    () => memoryCreateTest(teamId, input),
  );
}

export async function recordResult(
  testId: string,
  input: RecordResultInput,
): Promise<PracticeTeamResult> {
  return withOptionalDb(
    async (client) => {
      const { rows } = await client.query<PracticeTeamResult>(
        `INSERT INTO practice_team_results
           (test_id, member_id, call_attempt_id, total_score, won, turns_completed, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (test_id, member_id) DO UPDATE SET
           call_attempt_id = EXCLUDED.call_attempt_id,
           total_score = EXCLUDED.total_score,
           won = EXCLUDED.won,
           turns_completed = EXCLUDED.turns_completed,
           notes = EXCLUDED.notes
         RETURNING id, test_id AS "testId", member_id AS "memberId",
                   call_attempt_id AS "callAttemptId", total_score AS "totalScore",
                   won, turns_completed AS "turnsCompleted", notes,
                   created_at AS "createdAt"`,
        [
          testId,
          input.memberId,
          input.callAttemptId ?? null,
          Math.round(input.totalScore),
          input.won === true,
          input.turnsCompleted ?? 0,
          input.notes ?? null,
        ],
      );
      if (!rows[0]) throw new TeamStoreError("No se pudo guardar el resultado.");
      return rows[0];
    },
    () => memoryRecordResult(testId, input),
  );
}

export async function listResults(testId: string): Promise<PracticeTeamResult[]> {
  return withOptionalDb(
    async (client) => {
      const { rows } = await client.query<PracticeTeamResult>(
        `SELECT id, test_id AS "testId", member_id AS "memberId",
                call_attempt_id AS "callAttemptId", total_score AS "totalScore",
                won, turns_completed AS "turnsCompleted", notes,
                created_at AS "createdAt"
         FROM practice_team_results WHERE test_id = $1
         ORDER BY total_score DESC, created_at`,
        [testId],
      );
      return rows;
    },
    () => memoryListResults(testId),
  );
}

export async function findTest(
  testId: string,
): Promise<PracticeTeamTest | null> {
  return withOptionalDb(
    async (client) => {
      const { rows } = await client.query<PracticeTeamTest>(
        `SELECT id, team_id AS "teamId", scenario_slug AS "scenarioSlug",
                title, created_at AS "createdAt"
         FROM practice_team_tests WHERE id = $1`,
        [testId],
      );
      return rows[0] ?? null;
    },
    () => memoryFindTest(testId),
  );
}
