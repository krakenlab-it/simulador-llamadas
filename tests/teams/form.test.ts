import { describe, expect, it } from "vitest";
import {
  isDuplicateMember,
  memberEmailError,
  memberInitials,
  memberNameError,
  teamNameError,
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
});
