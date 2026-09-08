-- Kraken Lab cohort configuration for pasantes (interns) onboarding wizard

CREATE TABLE IF NOT EXISTS kraken_lab_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  call_attempt_id UUID REFERENCES call_attempts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kraken_lab_cohorts_created
  ON kraken_lab_cohorts (created_at DESC);

COMMENT ON TABLE kraken_lab_cohorts IS
  'Persisted Kraken Lab pasantes cohort wizard configuration and session links.';

COMMENT ON COLUMN kraken_lab_cohorts.config IS
  'Full wizard payload: participants, dialogue types, receiver personas, difficulty.';

ALTER TABLE kraken_lab_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY kraken_lab_cohorts_service ON kraken_lab_cohorts
  FOR ALL
  USING (true)
  WITH CHECK (true);
