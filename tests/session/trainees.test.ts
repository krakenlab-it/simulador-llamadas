import { describe, expect, it } from "vitest";
import { normalizeTraineeEmail } from "@/lib/session/trainees";

describe("trainee identity", () => {
  it("normalizes email for the light login gate", () => {
    expect(normalizeTraineeEmail("  Seb@Example.COM ")).toBe("seb@example.com");
    expect(normalizeTraineeEmail("")).toBeNull();
    expect(normalizeTraineeEmail(null)).toBeNull();
  });
});
