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

interface MemoryState {
  teams: PracticeTeam[];
  members: PracticeTeamMember[];
  tests: PracticeTeamTest[];
  results: PracticeTeamResult[];
}

const memory: MemoryState = {
  teams: [],
  members: [],
  tests: [],
  results: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(): string {
  return globalThis.crypto.randomUUID();
}

export class TeamStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamStoreError";
  }
}

export function resetTeamMemory(): void {
  memory.teams = [];
  memory.members = [];
  memory.tests = [];
  memory.results = [];
}

export function memoryCreateTeam(input: CreateTeamInput): PracticeTeam {
  const name = input.name.trim();
  if (!name) throw new TeamStoreError("El equipo necesita un nombre.");
  const team: PracticeTeam = {
    id: nextId(),
    name,
    createdBy: input.createdBy ?? null,
    createdAt: nowIso(),
  };
  memory.teams.push(team);
  return team;
}

export function memoryListTeams(): PracticeTeam[] {
  return [...memory.teams].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function memoryGetSnapshot(teamId: string): TeamSnapshot {
  const team = memory.teams.find((item) => item.id === teamId);
  if (!team) throw new TeamStoreError("Equipo no encontrado.");
  return {
    team,
    members: memory.members.filter((item) => item.teamId === teamId),
    tests: memory.tests
      .filter((item) => item.teamId === teamId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function memoryAddMember(
  teamId: string,
  input: AddMemberInput,
): PracticeTeamMember {
  memoryGetSnapshot(teamId);
  const displayName = input.displayName.trim();
  if (!displayName) throw new TeamStoreError("El miembro necesita un nombre.");
  const member: PracticeTeamMember = {
    id: nextId(),
    teamId,
    displayName,
    email: input.email?.trim().toLowerCase() || null,
    createdAt: nowIso(),
  };
  memory.members.push(member);
  return member;
}

export function memoryCreateTest(
  teamId: string,
  input: CreateTestInput,
): PracticeTeamTest {
  memoryGetSnapshot(teamId);
  const scenarioSlug = input.scenarioSlug.trim();
  if (!scenarioSlug) throw new TeamStoreError("El examen necesita un escenario.");
  const test: PracticeTeamTest = {
    id: nextId(),
    teamId,
    scenarioSlug,
    title: input.title?.trim() || `Mismo examen · ${scenarioSlug}`,
    createdAt: nowIso(),
  };
  memory.tests.push(test);
  return test;
}

export function memoryFindTest(testId: string): PracticeTeamTest | null {
  return memory.tests.find((item) => item.id === testId) ?? null;
}

export function memoryRecordResult(
  testId: string,
  input: RecordResultInput,
): PracticeTeamResult {
  const test = memoryFindTest(testId);
  if (!test) {
    throw new TeamStoreError("Examen no encontrado en este equipo.");
  }
  const snapshot = memoryGetSnapshot(test.teamId);
  if (!snapshot.members.some((member) => member.id === input.memberId)) {
    throw new TeamStoreError("Miembro no encontrado en este equipo.");
  }
  const existing = memory.results.find(
    (item) => item.testId === testId && item.memberId === input.memberId,
  );
  if (existing) {
    existing.totalScore = Math.round(input.totalScore);
    existing.won = input.won === true;
    existing.turnsCompleted = input.turnsCompleted ?? 0;
    existing.notes = input.notes ?? null;
    existing.callAttemptId = input.callAttemptId ?? null;
    return existing;
  }
  const result: PracticeTeamResult = {
    id: nextId(),
    testId,
    memberId: input.memberId,
    callAttemptId: input.callAttemptId ?? null,
    totalScore: Math.round(input.totalScore),
    won: input.won === true,
    turnsCompleted: input.turnsCompleted ?? 0,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  };
  memory.results.push(result);
  return result;
}

export function memoryListResults(testId: string): PracticeTeamResult[] {
  return memory.results
    .filter((item) => item.testId === testId)
    .sort((a, b) => b.totalScore - a.totalScore);
}
