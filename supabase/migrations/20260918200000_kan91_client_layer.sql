-- KAN-91: snapshot of trainer knobs + live client motor per call.
-- The PACK is case data (not a 20-field form). session_config stores the
-- few knobs a facilitator sets. client_layer_state stores meters and
-- meeting logistics for later serverless persist; live turns still
-- derive logistics from the transcript first.

ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS session_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_layer_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN call_attempts.session_config IS
  'KAN-91 trainer knobs + pack snapshot at call start (tone, motor, difficulty).';
COMMENT ON COLUMN call_attempts.client_layer_state IS
  'KAN-91 live client motor: meters (confianza/interés/paciencia), meetingAccepted, turn.';
