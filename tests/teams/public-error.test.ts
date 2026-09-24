import { describe, expect, it } from "vitest";
import { teamErrorMessage, TeamStoreError } from "@/lib/teams";

describe("team route errors", () => {
  it("keeps a validation message and hides driver text", () => {
    expect(
      teamErrorMessage(
        new TeamStoreError("El equipo necesita un nombre."),
        "No se pudo crear el equipo.",
      ),
    ).toBe("El equipo necesita un nombre.");

    expect(
      teamErrorMessage(
        new Error('column "session_config" of relation "call_attempts" does not exist'),
        "No se pudo crear el equipo.",
      ),
    ).toBe("No se pudo crear el equipo.");
  });
});
