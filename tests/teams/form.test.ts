import { describe, expect, it } from "vitest";
import {
  isDuplicateMember,
  memberEmailError,
  memberInitials,
  memberNameError,
  teamNameError,
  teamScoreError,
} from "@/lib/teams/form";

describe("team form helpers", () => {
  it("asks for a team name in plain Spanish", () => {
    expect(teamNameError("")).toMatch(/nombre del equipo/i);
    expect(teamNameError("Jaime / pasantes")).toBeNull();
  });

  it("validates optional email and duplicate people", () => {
    expect(memberNameError("")).toMatch(/nombre/i);
    expect(memberEmailError("")).toBeNull();
    expect(memberEmailError("jaime")).toMatch(/correo/i);
    expect(memberEmailError("jaime@equipo.com")).toBeNull();
    expect(isDuplicateMember("Jaime", [{ displayName: "jaime" }])).toBe(true);
    expect(isDuplicateMember("Ana", [{ displayName: "Jaime" }])).toBe(false);
    expect(memberInitials("Jaime Pérez")).toBe("JP");
  });

  it("keeps team scores inside 0 to 100", () => {
    expect(teamScoreError(Number.NaN)).toMatch(/0 y 100/);
    expect(teamScoreError(140)).toMatch(/0 y 100/);
    expect(teamScoreError(82)).toBeNull();
  });
});
