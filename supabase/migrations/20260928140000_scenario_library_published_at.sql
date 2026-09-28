-- Capacitador publishes tested custom scenarios to Biblioteca (shared catalog).
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS library_published_at TIMESTAMPTZ;

COMMENT ON COLUMN scenarios.library_published_at IS
  'When set, custom scenario appears in Biblioteca for assignment; clinic presets use is_preset separately.';
