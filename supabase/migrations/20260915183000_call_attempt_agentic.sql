-- Per-call agentic overlay for clinic presets and persisted meters across serverless turns.
ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS session_config JSONB,
  ADD COLUMN IF NOT EXISTS agentic_state JSONB;

COMMENT ON COLUMN call_attempts.session_config IS
  'Per-call scenario overlay (e.g. agentic runtime merged into clinic presets).';

COMMENT ON COLUMN call_attempts.agentic_state IS
  'Persisted agentic meters, mode, turn counter, and transcript offset for /reiniciar.';
