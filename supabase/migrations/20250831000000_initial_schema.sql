-- Clínica de Citas · Simulador de llamada
-- Cornerstone schema: trainees, scenarios (3 clients), calls, turns, scores, history view

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE practice_mode AS ENUM ('voz', 'texto');

CREATE TYPE round_type AS ENUM (
  'apertura',
  'objecion',
  'claridad',
  'correo',
  'cierre'
);

CREATE TYPE call_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- ---------------------------------------------------------------------------
-- Trainees (linked to Supabase auth.users when auth is enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE trainees IS 'Sales trainees / users practicing cold calls.';
COMMENT ON COLUMN trainees.auth_user_id IS 'Optional link to auth.users.id once Supabase Auth is wired.';

-- ---------------------------------------------------------------------------
-- Scenarios — exactly three seeded clients (do not add more in v1)
-- ---------------------------------------------------------------------------
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_title TEXT NOT NULL,
  company_context TEXT NOT NULL,
  difficulty_label TEXT NOT NULL,
  indicator TEXT NOT NULL,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  sort_order SMALLINT NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE scenarios IS 'Fixed catalog of three client personas for Module 3 clinic.';

-- ---------------------------------------------------------------------------
-- Call attempts
-- ---------------------------------------------------------------------------
CREATE TABLE call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
  difficulty_level SMALLINT NOT NULL CHECK (difficulty_level IN (1, 2, 3)),
  mode practice_mode NOT NULL,
  status call_status NOT NULL DEFAULT 'in_progress',
  won BOOLEAN,
  total_score NUMERIC(5, 2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT call_attempts_ended_after_start CHECK (
    ended_at IS NULL OR ended_at >= started_at
  )
);

CREATE INDEX idx_call_attempts_trainee ON call_attempts (trainee_id, started_at DESC);
CREATE INDEX idx_call_attempts_scenario ON call_attempts (scenario_id);

COMMENT ON TABLE call_attempts IS 'One simulated cold-call session (up to five turns).';
COMMENT ON COLUMN call_attempts.won IS 'True only when trainee secures concrete day AND time (cierre).';

-- ---------------------------------------------------------------------------
-- Turns — five rounds per call
-- ---------------------------------------------------------------------------
CREATE TABLE call_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_attempt_id UUID NOT NULL REFERENCES call_attempts(id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number BETWEEN 1 AND 5),
  round_type round_type NOT NULL,
  trainee_utterance TEXT,
  expected_phrase TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (call_attempt_id, round_number),
  UNIQUE (call_attempt_id, round_type)
);

CREATE INDEX idx_call_turns_attempt ON call_turns (call_attempt_id, round_number);

COMMENT ON TABLE call_turns IS 'Individual round within a call: apertura → cierre.';

-- ---------------------------------------------------------------------------
-- Scores per round (keyword analysis)
-- ---------------------------------------------------------------------------
CREATE TABLE turn_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL UNIQUE REFERENCES call_turns(id) ON DELETE CASCADE,
  keyword_hits JSONB NOT NULL DEFAULT '{}',
  round_score NUMERIC(5, 2) NOT NULL CHECK (round_score >= 0 AND round_score <= 100),
  has_concrete_day_and_time BOOLEAN NOT NULL DEFAULT false,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE turn_scores IS 'Keyword-based scoring per round (problema, medición, jerga, etc.).';
COMMENT ON COLUMN turn_scores.keyword_hits IS 'JSON map of scoring keywords to boolean hits.';

-- ---------------------------------------------------------------------------
-- History view (server-side replacement for localStorage clinicav2:historial)
-- ---------------------------------------------------------------------------
CREATE VIEW call_history AS
SELECT
  ca.id AS call_attempt_id,
  ca.trainee_id,
  s.slug AS scenario_slug,
  s.client_name,
  ca.difficulty_level,
  ca.mode,
  ca.status,
  ca.won,
  ca.total_score,
  ca.started_at,
  ca.ended_at,
  COUNT(ct.id)::INT AS turns_completed
FROM call_attempts ca
JOIN scenarios s ON s.id = ca.scenario_id
LEFT JOIN call_turns ct ON ct.call_attempt_id = ca.id
GROUP BY
  ca.id,
  ca.trainee_id,
  s.slug,
  s.client_name,
  ca.difficulty_level,
  ca.mode,
  ca.status,
  ca.won,
  ca.total_score,
  ca.started_at,
  ca.ended_at;

COMMENT ON VIEW call_history IS 'Aggregated call history for trainee dashboards.';

-- ---------------------------------------------------------------------------
-- Seed: three clients only
-- ---------------------------------------------------------------------------
INSERT INTO scenarios (
  slug,
  client_name,
  client_title,
  company_context,
  difficulty_label,
  indicator,
  pain_points,
  sort_order
) VALUES
  (
    'mariana-escobedo',
    'Mariana Escobedo',
    'Directora de Mercadotecnia',
    'Desarrolladora de vivienda media',
    'Difícil',
    'Visitas a caseta',
    ARRAY[
      'Costo por prospecto +40%',
      'Formularios que no visitan',
      'Espectaculares sin medición'
    ],
    1
  ),
  (
    'rodrigo-nava',
    'Rodrigo Nava',
    'Gerente de Medios',
    'Cadena nacional de farmacias',
    'Muy difícil',
    'Tráfico a tienda / venta por m²',
    ARRAY[
      'Aperturas de proximidad que no levantan'
    ],
    2
  ),
  (
    'efrain-loera',
    'Efraín Loera',
    'Director Comercial',
    'Grupo distribuidor automotriz',
    'Media',
    'Piso con menos gente',
    ARRAY[
      'No cree en clics'
    ],
    3
  );

-- ---------------------------------------------------------------------------
-- Row Level Security (baseline — tighten per-trainee in auth PR)
-- ---------------------------------------------------------------------------
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenarios_read_all ON scenarios
  FOR SELECT
  USING (true);

-- Service role bypasses RLS; authenticated policies added in auth PR.
