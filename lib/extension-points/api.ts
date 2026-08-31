/**
 * API extension point — session routes implemented in app/api/sessions.
 */

export const API_EXTENSION_VERSION = "0.2.0";

export type ApiRoute =
  | "sessions.create"
  | "sessions.submitTurn"
  | "sessions.end"
  | "history.list";

export const API_ROUTES = {
  create: "POST /api/sessions",
  submitTurn: "POST /api/sessions/:id/turns",
  end: "POST /api/sessions/:id/end",
  listHistory: "GET /api/history",
} as const;
