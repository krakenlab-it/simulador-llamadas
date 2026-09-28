import { describe, expect, it, beforeEach } from "vitest";
import {
  assignmentForAgent,
  createProject,
  defaultCapacitadorAssignmentSeed,
  readTrainingOffice,
  upsertAssignment,
  writeTrainingOffice,
} from "@/lib/frontend/training-office";

const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  } as unknown as Storage;
};

describe("training office demo persistence", () => {
  let store: Storage;

  beforeEach(() => {
    store = storage();
    writeTrainingOffice(
      {
        projects: [
          { id: "p1", name: "Demo", createdAt: new Date().toISOString() },
        ],
        assignments: [],
        activeProjectIdCapacitador: "p1",
        activeProjectIdAgente: "p1",
      },
      store,
    );
  });

  it("creates projects and assignments", () => {
    let state = readTrainingOffice(store);
    state = createProject(state, "Nuevo");
    state = upsertAssignment(state, {
      projectId: state.projects[1].id,
      agentEmail: "a@test.com",
      agentDisplayName: "Ana",
      profile: {
        firstName: "Ana",
        lastName: "López",
        age: 28,
        email: "a@test.com",
        phone: "55 0000 0000",
      },
      scenarioSlugs: ["mariana"],
      requiredSimulations: 3,
      showGradesToAgent: true,
    });
    writeTrainingOffice(state, store);
    const loaded = readTrainingOffice(store);
    expect(assignmentForAgent(loaded, loaded.projects[1].id, "a@test.com")).toMatchObject({
      requiredSimulations: 3,
      profile: expect.objectContaining({ firstName: "Ana", email: "a@test.com" }),
    });
  });

  it("seeds demo assignment when empty", () => {
    const state = readTrainingOffice(store);
    const seeded = defaultCapacitadorAssignmentSeed(state, ["a", "b", "c"]);
    expect(seeded.assignments.length).toBe(1);
    expect(seeded.assignments[0].scenarioSlugs).toEqual(["a", "b", "c"]);
  });
});
