export interface PracticeTeam {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
}

export interface PracticeTeamMember {
  id: string;
  teamId: string;
  displayName: string;
  email: string | null;
  createdAt: string;
}

export interface PracticeTeamTest {
  id: string;
  teamId: string;
  scenarioSlug: string;
  title: string;
  createdAt: string;
}

export interface PracticeTeamResult {
  id: string;
  testId: string;
  memberId: string;
  callAttemptId: string | null;
  totalScore: number;
  won: boolean;
  turnsCompleted: number;
  notes: string | null;
  createdAt: string;
}

export interface CreateTeamInput {
  name: string;
  createdBy?: string | null;
}

export interface AddMemberInput {
  displayName: string;
  email?: string | null;
}

export interface CreateTestInput {
  scenarioSlug: string;
  title?: string;
}

export interface RecordResultInput {
  memberId: string;
  totalScore: number;
  won?: boolean;
  turnsCompleted?: number;
  notes?: string | null;
  callAttemptId?: string | null;
}

export interface TeamSnapshot {
  team: PracticeTeam;
  members: PracticeTeamMember[];
  tests: PracticeTeamTest[];
}
