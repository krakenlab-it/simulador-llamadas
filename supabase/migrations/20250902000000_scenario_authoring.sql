-- ===========================================================================
-- 20250902000000_scenario_authoring.sql
-- ===========================================================================
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- Custom scenarios already exist next to the three clinic presets. Authoring
-- was create-only and did not persist language or let a trainer edit a case.
-- This migration adds a readable language field (for later voice lock PRs)
-- and an UPDATE policy so custom rows can be edited. Clinic presets stay
-- locked: mariana / rodrigo / efrain cannot be updated through this policy.
--
-- Beats, success criteria, and KLM-50 "qué se ve bien" live in scenarios.config
-- (JSONB). No second scorecard table.
--
-- Depends on: 20250831000003_relax_three_scenario_limit.sql
-- ===========================================================================

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es';

ALTER TABLE scenarios
  DROP CONSTRAINT IF EXISTS scenarios_language_check;

ALTER TABLE scenarios
  ADD CONSTRAINT scenarios_language_check
  CHECK (language IN ('es', 'en', 'pt'));

COMMENT ON COLUMN scenarios.language IS
  'Spoken language of the scenario (ISO 639-1). Clinic defaults to es. Authoring writes this; language lock (#28) reads it.';

UPDATE scenarios
  SET language = 'es'
  WHERE language IS NULL OR language = '';

CREATE POLICY scenarios_update_custom ON scenarios
  FOR UPDATE
  USING (is_preset = false)
  WITH CHECK (is_preset = false);
