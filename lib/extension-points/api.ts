/**
 * API extension point — implement in a follow-up PR.
 *
 * Planned routes (App Router):
 * - POST /api/sessions          — start call attempt
 * - POST /api/sessions/:id/turns — submit trainee utterance per round
 * - POST /api/sessions/:id/end   — hang up and trigger scoring
 * - GET  /api/history            — server-side history (replaces localStorage)
 */

export const API_EXTENSION_VERSION = "0.1.0";

export type ApiRoutePlaceholder =
  | "sessions.create"
  | "sessions.submitTurn"
  | "sessions.end"
  | "history.list";
