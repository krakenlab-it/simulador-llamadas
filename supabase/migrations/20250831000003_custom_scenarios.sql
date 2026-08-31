-- General sales-call simulator: custom scenarios alongside clinic presets
-- Depends on: 20250831000001_clinic_content_seed.sql

-- ---------------------------------------------------------------------------
-- Relax v1 "exactly three scenarios" constraints
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_three_scenarios ON scenarios;
DROP FUNCTION IF EXISTS enforce_exactly_three_scenarios();
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_slug_v1;

-- ---------------------------------------------------------------------------
-- Extend scenarios for custom user-defined training sessions
-- ---------------------------------------------------------------------------
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS is_preset BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS product_sold TEXT,
  ADD COLUMN IF NOT EXISTS temperament TEXT,
  ADD COLUMN IF NOT EXISTS client_problem TEXT,
  ADD COLUMN IF NOT EXISTS objections TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS win_criteria TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL;

UPDATE scenarios SET is_preset = true WHERE slug IN ('mariana', 'rodrigo', 'efrain');

ALTER TABLE scenarios ALTER COLUMN sort_order DROP NOT NULL;

COMMENT ON COLUMN scenarios.is_preset IS 'True for built-in Clínica de Citas personas (mariana, rodrigo, efrain).';
COMMENT ON COLUMN scenarios.config IS 'Round definitions, scoring criteria, and simulation prompts for custom scenarios.';

-- ---------------------------------------------------------------------------
-- Flexible rounds per call (1–10 rounds; custom labels)
-- ---------------------------------------------------------------------------
ALTER TABLE call_turns DROP CONSTRAINT IF EXISTS call_turns_round_number_check;
ALTER TABLE call_turns ADD CONSTRAINT call_turns_round_number_check
  CHECK (round_number BETWEEN 1 AND 10);

ALTER TABLE call_turns DROP CONSTRAINT IF EXISTS call_turns_call_attempt_id_round_type_key;
ALTER TABLE call_turns ALTER COLUMN round_type DROP NOT NULL;

ALTER TABLE call_turns
  ADD COLUMN IF NOT EXISTS round_key TEXT,
  ADD COLUMN IF NOT EXISTS round_label TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_turns_attempt_round_key
  ON call_turns (call_attempt_id, round_key)
  WHERE round_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rich per-round feedback (why, stronger line, missed criteria)
-- ---------------------------------------------------------------------------
ALTER TABLE turn_scores
  ADD COLUMN IF NOT EXISTS feedback_detail JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN turn_scores.feedback_detail IS
  'Rich coaching: whyScore, strongerLine, missedCriteria, roundLabel.';

-- ---------------------------------------------------------------------------
-- Session-level evaluation summary
-- ---------------------------------------------------------------------------
ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS evaluation_summary JSONB;

COMMENT ON COLUMN call_attempts.evaluation_summary IS
  'End-of-call verdict, strongest/weakest round, next drill, trend snapshot.';

-- ---------------------------------------------------------------------------
-- Enriched call_history with preset flag and industry
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS call_history;

CREATE VIEW call_history AS
SELECT
  ca.id AS call_attempt_id,
  ca.trainee_id,
  s.slug AS scenario_slug,
  s.client_name,
  s.is_preset,
  s.industry,
  ca.difficulty_level,
  ca.mode,
  ca.status,
  ca.won,
  ca.total_score,
  ca.started_at,
  ca.ended_at,
  COUNT(ct.id)::INT AS turns_completed,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'round_number', ct.round_number,
        'round_type', ct.round_type,
        'round_key', ct.round_key,
        'round_label', ct.round_label,
        'round_score', ts.round_score,
        'has_concrete_day_and_time', ts.has_concrete_day_and_time
      )
      ORDER BY ct.round_number
    ) FILTER (WHERE ct.id IS NOT NULL),
    '[]'::jsonb
  ) AS round_scores
FROM call_attempts ca
JOIN scenarios s ON s.id = ca.scenario_id
LEFT JOIN call_turns ct ON ct.call_attempt_id = ca.id
LEFT JOIN turn_scores ts ON ts.turn_id = ct.id
GROUP BY
  ca.id,
  ca.trainee_id,
  s.slug,
  s.client_name,
  s.is_preset,
  s.industry,
  ca.difficulty_level,
  ca.mode,
  ca.status,
  ca.won,
  ca.total_score,
  ca.started_at,
  ca.ended_at;

-- ---------------------------------------------------------------------------
-- RLS: allow inserting custom scenarios (service role in API)
-- ---------------------------------------------------------------------------
CREATE POLICY scenarios_insert_custom ON scenarios
  FOR INSERT
  WITH CHECK (is_preset = false);
