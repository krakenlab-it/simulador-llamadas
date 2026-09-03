import { describe, expect, it } from "vitest";
import { SessionError, toPublicRouteError } from "@/lib/session/errors";

describe("toPublicRouteError", () => {
  it("maps a missing-column Postgres error to schema_outdated without driver text", () => {
    const error = Object.assign(new Error('column "voice_agent" does not exist'), {
      code: "42703",
    });

    expect(toPublicRouteError(error, "No se pudo iniciar la llamada.")).toEqual({
      status: 503,
      body: {
        error:
          "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
        code: "schema_outdated",
      },
    });
  });

  it("keeps a SessionError as-is", () => {
    const error = new SessionError("session_not_found");
    expect(toPublicRouteError(error, "fallback")).toEqual({
      status: 404,
      body: {
        error: "No encontramos esta llamada.",
        code: "session_not_found",
      },
    });
  });

  it("hides unknown driver text behind the caller fallback", () => {
    const error = new Error('duplicate key value violates unique constraint "x"');
    expect(toPublicRouteError(error, "No se pudo iniciar la llamada.")).toEqual({
      status: 500,
      body: { error: "No se pudo iniciar la llamada." },
    });
  });
});
