-- Trainer voice-agent knobs live beside the scenario so a replay uses the
-- same language, premade voice, rate, personality, and barge-in. Dedicated
-- column so scenario.config stays free for authoring.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS voice_agent JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN scenarios.voice_agent IS
  'Trainer voice-agent knobs persisted so a replay uses the same agent.';
