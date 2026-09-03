-- Voice spend brakes: server-side counters for ElevenLabs billed path.
-- Counts seconds and characters only — no dollar meter.
--
-- DO NOT ENABLE ROW LEVEL SECURITY on voice_* tables until there are
-- service-role-only or explicit insert/update policies. The live call
-- bills through DATABASE_URL / withPgClient and would keep working, but
-- any future browser/anon client would be locked out of usage + brakes.

-- ---------------------------------------------------------------------------
-- Verified email for billed voice (magic-link proof, not full trainee accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE voice_verified_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  auth_user_id UUID UNIQUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE voice_verified_users IS
  'Users who proved email before a billed ElevenLabs voice session.';

-- ---------------------------------------------------------------------------
-- Per-session usage (one row per billed voice call attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE voice_session_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_attempt_id UUID REFERENCES call_attempts(id) ON DELETE SET NULL,
  verified_user_id UUID NOT NULL REFERENCES voice_verified_users(id) ON DELETE CASCADE,
  convai_seconds_used INTEGER NOT NULL DEFAULT 0 CHECK (convai_seconds_used >= 0),
  trainee_audio_seconds_used INTEGER NOT NULL DEFAULT 0 CHECK (trainee_audio_seconds_used >= 0),
  extra_tts_chars_used INTEGER NOT NULL DEFAULT 0 CHECK (extra_tts_chars_used >= 0),
  convai_slot_held BOOLEAN NOT NULL DEFAULT false,
  convai_slot_released_at TIMESTAMPTZ,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_session_usage_user ON voice_session_usage (verified_user_id, created_at DESC);
CREATE INDEX idx_voice_session_usage_active_slots ON voice_session_usage (convai_slot_held)
  WHERE convai_slot_held = true;

COMMENT ON TABLE voice_session_usage IS
  'Per billed session counters: ConvAI wall clock, trainee audio, extra TTS chars.';

-- ---------------------------------------------------------------------------
-- Per-user daily: one billed session per UTC day on the public URL
-- ---------------------------------------------------------------------------
CREATE TABLE voice_daily_user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_user_id UUID NOT NULL REFERENCES voice_verified_users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC'),
  billed_sessions_used INTEGER NOT NULL DEFAULT 0 CHECK (billed_sessions_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verified_user_id, usage_date)
);

COMMENT ON TABLE voice_daily_user_usage IS
  'One billed session per user per UTC day; retries same day use Web Speech.';

-- ---------------------------------------------------------------------------
-- Global monthly ConvAI seconds (300 minutes = 18000 seconds)
-- ---------------------------------------------------------------------------
CREATE TABLE voice_global_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_year SMALLINT NOT NULL,
  usage_month SMALLINT NOT NULL CHECK (usage_month BETWEEN 1 AND 12),
  convai_seconds_used INTEGER NOT NULL DEFAULT 0 CHECK (convai_seconds_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usage_year, usage_month)
);

COMMENT ON TABLE voice_global_monthly_usage IS
  'Global monthly ConvAI seconds; 300 minutes then Web Speech for everyone.';
