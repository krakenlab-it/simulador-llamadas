/**
 * Domain errors for the call loop. Every failure that reaches the trainee is
 * one of these codes with a Spanish message; driver text (PG constraint names,
 * SQL snippets) never leaves the server.
 */

export type SessionErrorCode =
  | "session_not_found"
  | "session_not_in_progress"
  | "rounds_completed"
  | "empty_utterance"
  | "invalid_request"
  | "invalid_round"
  | "turn_conflict"
  | "schema_outdated"
  | "turn_failed";

const HTTP_STATUS: Record<SessionErrorCode, number> = {
  session_not_found: 404,
  session_not_in_progress: 409,
  rounds_completed: 409,
  empty_utterance: 400,
  invalid_request: 400,
  invalid_round: 409,
  turn_conflict: 409,
  schema_outdated: 503,
  turn_failed: 500,
};

const MESSAGES: Record<SessionErrorCode, string> = {
  session_not_found: "No encontramos esta llamada.",
  session_not_in_progress: "Esta llamada ya terminó.",
  rounds_completed: "Ya completaste todas las rondas de esta llamada.",
  empty_utterance: "Escribe o dicta tu respuesta antes de enviar.",
  invalid_request: "Solicitud inválida.",
  invalid_round: "Esta ronda ya no está disponible.",
  turn_conflict: "Ese turno ya se registró. Espera la respuesta del cliente.",
  schema_outdated:
    "La base de datos no tiene la última migración aplicada. Avisa al equipo técnico.",
  turn_failed: "No se pudo registrar el turno. Intenta de nuevo.",
};

export class SessionError extends Error {
  readonly code: SessionErrorCode;
  readonly httpStatus: number;

  constructor(code: SessionErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = "SessionError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}

const PG_UNIQUE_VIOLATION = "23505";
/** allocate_call_turn / its columns are missing: migrations were not applied. */
const PG_MISSING_SCHEMA = ["42883", "42703", "42P01"];

function pgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Normalizes anything thrown while submitting a turn. A unique violation means
 * a duplicate submit slipped past the atomic allocation, which is a conflict
 * for the caller — not a raw constraint name in a toast.
 */
export function toSessionError(error: unknown): SessionError {
  if (error instanceof SessionError) return error;

  const code = pgErrorCode(error);
  if (code === PG_UNIQUE_VIOLATION) return new SessionError("turn_conflict");
  if (code && PG_MISSING_SCHEMA.includes(code)) {
    return new SessionError("schema_outdated");
  }

  return new SessionError("turn_failed");
}
