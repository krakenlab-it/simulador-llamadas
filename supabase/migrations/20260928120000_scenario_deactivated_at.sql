-- Soft-retire custom scenarios (Capacitador «dar de baja»). Presets stay always active.
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

COMMENT ON COLUMN scenarios.deactivated_at IS
  'When set, scenario is hidden from Agente practice; history remains.';
