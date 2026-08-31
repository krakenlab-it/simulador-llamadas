-- Clínica de Citas · Simulador de llamada
-- Schema tighten + clinic content seed (ported from docs/prototype)
-- Depends on: 20250831000000_initial_schema.sql

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE reaction_quality AS ENUM ('bien', 'medio', 'mal');

-- ---------------------------------------------------------------------------
-- Tighten scenarios: short slugs mariana | rodrigo | efrain (exactly three)
-- ---------------------------------------------------------------------------
UPDATE scenarios SET slug = 'mariana' WHERE slug = 'mariana-escobedo';
UPDATE scenarios SET slug = 'rodrigo' WHERE slug = 'rodrigo-nava';
UPDATE scenarios SET slug = 'efrain' WHERE slug = 'efrain-loera';

ALTER TABLE scenarios
  ADD CONSTRAINT scenarios_slug_v1 CHECK (slug IN ('mariana', 'rodrigo', 'efrain'));

CREATE OR REPLACE FUNCTION enforce_exactly_three_scenarios()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM scenarios) > 3 THEN
    RAISE EXCEPTION 'Exactly three scenarios allowed in v1';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_three_scenarios
  AFTER INSERT ON scenarios
  FOR EACH ROW
  EXECUTE FUNCTION enforce_exactly_three_scenarios();

COMMENT ON CONSTRAINT scenarios_slug_v1 ON scenarios IS
  'v1 catalog: mariana (Mariana Escobedo), rodrigo (Rodrigo Nava), efrain (Efraín Loera).';

-- ---------------------------------------------------------------------------
-- Ficha — client sheet for the formador / trainee briefing
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_fichas (
  scenario_id UUID PRIMARY KEY REFERENCES scenarios(id) ON DELETE CASCADE,
  resumen TEXT NOT NULL,
  indicador_clave TEXT NOT NULL,
  contexto_negocio TEXT NOT NULL,
  notas_formador TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE scenario_fichas IS 'One-page client ficha per scenario (Module 3 clinic).';

-- ---------------------------------------------------------------------------
-- Problemas — concrete pain statements (extends pain_points for training)
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_problemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  sort_order SMALLINT NOT NULL CHECK (sort_order >= 1),
  UNIQUE (scenario_id, sort_order)
);

CREATE INDEX idx_scenario_problemas_scenario ON scenario_problemas (scenario_id, sort_order);

COMMENT ON TABLE scenario_problemas IS 'Client problem statements referenced in claridad / objeción rounds.';

-- ---------------------------------------------------------------------------
-- Claves — key talking points the trainee must hit
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_claves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  sort_order SMALLINT NOT NULL CHECK (sort_order >= 1),
  UNIQUE (scenario_id, sort_order)
);

CREATE INDEX idx_scenario_claves_scenario ON scenario_claves (scenario_id, sort_order);

COMMENT ON TABLE scenario_claves IS 'Sales keys / claves de venta per client persona.';

-- ---------------------------------------------------------------------------
-- Saludos — opening client lines (apertura); optional difficulty variant
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_saludos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  saludo TEXT NOT NULL,
  difficulty_level SMALLINT CHECK (difficulty_level IS NULL OR difficulty_level IN (1, 2, 3)),
  sort_order SMALLINT NOT NULL CHECK (sort_order >= 1),
  UNIQUE (scenario_id, difficulty_level, sort_order)
);

CREATE INDEX idx_scenario_saludos_scenario ON scenario_saludos (scenario_id, sort_order);

COMMENT ON TABLE scenario_saludos IS 'Client saludos at call start; NULL difficulty = all levels.';

-- ---------------------------------------------------------------------------
-- Reacciones — client pushback by round + trainee quality (bien|medio|mal)
-- Applies to apertura, objecion, claridad, correo (not cierre).
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_reacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  round_type round_type NOT NULL,
  quality reaction_quality NOT NULL,
  reaccion TEXT NOT NULL,
  CONSTRAINT scenario_reacciones_round CHECK (
    round_type IN ('apertura', 'objecion', 'claridad', 'correo')
  ),
  UNIQUE (scenario_id, round_type, quality)
);

CREATE INDEX idx_scenario_reacciones_lookup
  ON scenario_reacciones (scenario_id, round_type, quality);

COMMENT ON TABLE scenario_reacciones IS
  'Client reactions keyed by round and trainee performance tier (bien/medio/mal).';

-- ---------------------------------------------------------------------------
-- Cierres — client lines for the cierre round
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_cierres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  cierre TEXT NOT NULL,
  difficulty_level SMALLINT CHECK (difficulty_level IS NULL OR difficulty_level IN (1, 2, 3)),
  sort_order SMALLINT NOT NULL CHECK (sort_order >= 1),
  UNIQUE (scenario_id, difficulty_level, sort_order)
);

CREATE INDEX idx_scenario_cierres_scenario ON scenario_cierres (scenario_id, sort_order);

COMMENT ON TABLE scenario_cierres IS 'Default client lines when negotiating día y hora (cierre round).';

-- ---------------------------------------------------------------------------
-- Frases — expected trainee utterance guidance per round
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_frases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  round_type round_type NOT NULL,
  frase_esperada TEXT NOT NULL,
  UNIQUE (scenario_id, round_type)
);

CREATE INDEX idx_scenario_frases_scenario ON scenario_frases (scenario_id, round_type);

COMMENT ON TABLE scenario_frases IS 'Coach phrase: what the trainee should have said each round.';

-- ---------------------------------------------------------------------------
-- Round prompts — default client line per round (prototype clientLine)
-- ---------------------------------------------------------------------------
CREATE TABLE scenario_round_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  round_type round_type NOT NULL,
  prompt_cliente TEXT NOT NULL,
  UNIQUE (scenario_id, round_type)
);

CREATE INDEX idx_scenario_round_prompts_scenario
  ON scenario_round_prompts (scenario_id, round_type);

COMMENT ON TABLE scenario_round_prompts IS
  'Baseline client dialogue per round before quality-based reacciones.';

-- ---------------------------------------------------------------------------
-- Enriched call_history: per-round scores
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW call_history AS
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
  COUNT(ct.id)::INT AS turns_completed,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'round_number', ct.round_number,
        'round_type', ct.round_type,
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
  ca.difficulty_level,
  ca.mode,
  ca.status,
  ca.won,
  ca.total_score,
  ca.started_at,
  ca.ended_at;

COMMENT ON VIEW call_history IS
  'Aggregated call history with per-round scores (replaces clinicav2:historial).';

-- ---------------------------------------------------------------------------
-- Row Level Security for content tables (read-only catalog)
-- ---------------------------------------------------------------------------
ALTER TABLE scenario_fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_problemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_claves ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_saludos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_reacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_frases ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_round_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenario_fichas_read_all ON scenario_fichas FOR SELECT USING (true);
CREATE POLICY scenario_problemas_read_all ON scenario_problemas FOR SELECT USING (true);
CREATE POLICY scenario_claves_read_all ON scenario_claves FOR SELECT USING (true);
CREATE POLICY scenario_saludos_read_all ON scenario_saludos FOR SELECT USING (true);
CREATE POLICY scenario_reacciones_read_all ON scenario_reacciones FOR SELECT USING (true);
CREATE POLICY scenario_cierres_read_all ON scenario_cierres FOR SELECT USING (true);
CREATE POLICY scenario_frases_read_all ON scenario_frases FOR SELECT USING (true);
CREATE POLICY scenario_round_prompts_read_all ON scenario_round_prompts FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Seed helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _scenario_id(p_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM scenarios WHERE slug = p_slug;
$$;

-- Shared expected phrases (prototype EXPECTED object)
CREATE OR REPLACE FUNCTION _seed_scenario_frases(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO scenario_frases (scenario_id, round_type, frase_esperada) VALUES
    (_scenario_id(p_slug), 'apertura',
     'Reconozca el indicador del cliente y proponga medición, sin monólogo ni telegrama.'),
    (_scenario_id(p_slug), 'objecion',
     'Valide la objeción, use jerga del sector y evite descalificar.'),
    (_scenario_id(p_slug), 'claridad',
     'Nombre el problema concreto y cómo lo medirían juntos.'),
    (_scenario_id(p_slug), 'correo',
     'Pida permiso para enviar algo breve; no diga gratis sin contexto.'),
    (_scenario_id(p_slug), 'cierre',
     'Proponga reunión con día Y hora concretos. Sin ambigüedad.');
END;
$$;

-- ---------------------------------------------------------------------------
-- MARIANA — Mariana Escobedo (prototype id: mariana)
-- ---------------------------------------------------------------------------
INSERT INTO scenario_fichas (scenario_id, resumen, indicador_clave, contexto_negocio, notas_formador)
VALUES (
  _scenario_id('mariana'),
  'Directora de Mercadotecnia en desarrolladora de vivienda media. Presionada por costo por prospecto y caseta sin tráfico calificado.',
  'Visitas a caseta',
  'Desarrolladora de vivienda media — campañas offline (espectaculares, caseta) con poca medición.',
  'Cliente difícil: valida indicador antes de escuchar propuesta. Evitar pitch genérico de agencia.'
);

INSERT INTO scenario_problemas (scenario_id, descripcion, sort_order) VALUES
  (_scenario_id('mariana'), 'Costo por prospecto +40%', 1),
  (_scenario_id('mariana'), 'Formularios que no visitan caseta', 2),
  (_scenario_id('mariana'), 'Espectaculares sin medición de visitas', 3);

INSERT INTO scenario_claves (scenario_id, clave, sort_order) VALUES
  (_scenario_id('mariana'), 'Hablar en visitas a caseta, no en branding', 1),
  (_scenario_id('mariana'), 'Medición antes de prometer resultados', 2),
  (_scenario_id('mariana'), 'Reconocer que ya tienen agencia y caseta', 3),
  (_scenario_id('mariana'), 'Propuesta concreta de cómo medirían juntos', 4);

INSERT INTO scenario_saludos (scenario_id, saludo, difficulty_level, sort_order) VALUES
  (_scenario_id('mariana'), '¿Quién habla? Estoy entre juntas.', NULL, 1),
  (_scenario_id('mariana'), 'Ya tenemos agencia y caseta. No busco otra cosa.', NULL, 2),
  (_scenario_id('mariana'), 'Si es otro discurso de caseta, cuelgo.', 3, 1);

INSERT INTO scenario_round_prompts (scenario_id, round_type, prompt_cliente) VALUES
  (_scenario_id('mariana'), 'apertura', '¿Quién habla? Estoy entre juntas.'),
  (_scenario_id('mariana'), 'objecion', 'Eso ya lo escuché. ¿Qué resultado me trae a caseta?'),
  (_scenario_id('mariana'), 'claridad', 'Explíqueme en una frase qué medirían en visitas a caseta.'),
  (_scenario_id('mariana'), 'correo', 'Mande su correo, pero sea breve.'),
  (_scenario_id('mariana'), 'cierre', 'Si no hay fecha en la agenda, no hay reunión.');

INSERT INTO scenario_reacciones (scenario_id, round_type, quality, reaccion) VALUES
  (_scenario_id('mariana'), 'apertura', 'bien', 'De acuerdo, las visitas a caseta sí me importan. Siga.'),
  (_scenario_id('mariana'), 'apertura', 'medio', 'Ya tenemos agencia. ¿Qué tiene de diferente?'),
  (_scenario_id('mariana'), 'apertura', 'mal', 'No tengo tiempo. Mande información por correo.'),
  (_scenario_id('mariana'), 'objecion', 'bien', 'Tiene sentido medir antes de gastar más. Continúe.'),
  (_scenario_id('mariana'), 'objecion', 'medio', 'Eso ya lo escuché. ¿Qué resultado me trae?'),
  (_scenario_id('mariana'), 'objecion', 'mal', 'Suena a lo mismo que mi agencia actual.'),
  (_scenario_id('mariana'), 'claridad', 'bien', 'Ok, eso sí lo entiendo. ¿Cómo lo medirían?'),
  (_scenario_id('mariana'), 'claridad', 'medio', 'Explíqueme en una frase qué medirían.'),
  (_scenario_id('mariana'), 'claridad', 'mal', 'Muy vago. No veo el problema concreto.'),
  (_scenario_id('mariana'), 'correo', 'bien', 'Está bien, algo breve. ¿A qué correo lo mando?'),
  (_scenario_id('mariana'), 'correo', 'medio', 'Mande su correo, pero sea breve.'),
  (_scenario_id('mariana'), 'correo', 'mal', 'No quiero spam ni promesas gratis.');

INSERT INTO scenario_cierres (scenario_id, cierre, difficulty_level, sort_order) VALUES
  (_scenario_id('mariana'), 'Si no hay fecha en la agenda, no hay reunión.', NULL, 1),
  (_scenario_id('mariana'), 'Proponga día y hora o cuelgo.', 3, 1);

SELECT _seed_scenario_frases('mariana');

-- ---------------------------------------------------------------------------
-- RODRIGO — Rodrigo Nava
-- ---------------------------------------------------------------------------
INSERT INTO scenario_fichas (scenario_id, resumen, indicador_clave, contexto_negocio, notas_formador)
VALUES (
  _scenario_id('rodrigo'),
  'Gerente de Medios en cadena nacional de farmacias. Obsesionado con tráfico a tienda y venta por m².',
  'Tráfico a tienda / venta por m²',
  'Retail farmacéutico — aperturas de proximidad que no levantan venta en piso.',
  'Cliente muy difícil: corta discursos de branding. Hablar tráfico y m² desde la apertura.'
);

INSERT INTO scenario_problemas (scenario_id, descripcion, sort_order) VALUES
  (_scenario_id('rodrigo'), 'Aperturas de proximidad que no levantan venta', 1),
  (_scenario_id('rodrigo'), 'Medios sin correlación a tráfico en tienda', 2),
  (_scenario_id('rodrigo'), 'Presión por venta por m² en nuevas aperturas', 3);

INSERT INTO scenario_claves (scenario_id, clave, sort_order) VALUES
  (_scenario_id('rodrigo'), 'Tráfico a tienda, no awareness', 1),
  (_scenario_id('rodrigo'), 'Venta por m² como lenguaje común', 2),
  (_scenario_id('rodrigo'), 'Validar objeción de branding genérico', 3),
  (_scenario_id('rodrigo'), 'Medición de incremento en piso', 4);

INSERT INTO scenario_saludos (scenario_id, saludo, difficulty_level, sort_order) VALUES
  (_scenario_id('rodrigo'), 'Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?', NULL, 1),
  (_scenario_id('rodrigo'), 'Si es otro discurso de branding, cuelgo.', NULL, 2),
  (_scenario_id('rodrigo'), 'Dos minutos. Hable en m² o cuelgo.', 3, 1);

INSERT INTO scenario_round_prompts (scenario_id, round_type, prompt_cliente) VALUES
  (_scenario_id('rodrigo'), 'apertura', 'Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?'),
  (_scenario_id('rodrigo'), 'objecion', 'Eso ya lo escuché. ¿Qué resultado me trae en tráfico?'),
  (_scenario_id('rodrigo'), 'claridad', 'Explíqueme en una frase qué medirían en tienda.'),
  (_scenario_id('rodrigo'), 'correo', 'Mande su correo, pero sea breve.'),
  (_scenario_id('rodrigo'), 'cierre', 'Si no hay fecha en la agenda, no hay reunión.');

INSERT INTO scenario_reacciones (scenario_id, round_type, quality, reaccion) VALUES
  (_scenario_id('rodrigo'), 'apertura', 'bien', 'Tráfico a tienda sí me interesa. Adelante.'),
  (_scenario_id('rodrigo'), 'apertura', 'medio', '¿Qué tiene que ver con tráfico a tienda?'),
  (_scenario_id('rodrigo'), 'apertura', 'mal', 'Si es branding, cuelgo.'),
  (_scenario_id('rodrigo'), 'objecion', 'bien', 'Bien, hable de m² entonces.'),
  (_scenario_id('rodrigo'), 'objecion', 'medio', 'Eso ya lo escuché. ¿Qué resultado me trae?'),
  (_scenario_id('rodrigo'), 'objecion', 'mal', 'No veo relación con venta en piso.'),
  (_scenario_id('rodrigo'), 'claridad', 'bien', 'Entiendo el indicador. ¿Cómo lo medirían?'),
  (_scenario_id('rodrigo'), 'claridad', 'medio', 'Explíqueme en una frase qué medirían.'),
  (_scenario_id('rodrigo'), 'claridad', 'mal', 'Sigue siendo muy genérico.'),
  (_scenario_id('rodrigo'), 'correo', 'bien', 'Ok, algo corto sobre tráfico a tienda.'),
  (_scenario_id('rodrigo'), 'correo', 'medio', 'Mande su correo, pero sea breve.'),
  (_scenario_id('rodrigo'), 'correo', 'mal', 'No mandaré mi correo a otro pitch.');

INSERT INTO scenario_cierres (scenario_id, cierre, difficulty_level, sort_order) VALUES
  (_scenario_id('rodrigo'), 'Si no hay fecha en la agenda, no hay reunión.', NULL, 1),
  (_scenario_id('rodrigo'), 'Día y hora concretos o no hay cita.', 3, 1);

SELECT _seed_scenario_frases('rodrigo');

-- ---------------------------------------------------------------------------
-- EFRAIN — Efraín Loera
-- ---------------------------------------------------------------------------
INSERT INTO scenario_fichas (scenario_id, resumen, indicador_clave, contexto_negocio, notas_formador)
VALUES (
  _scenario_id('efrain'),
  'Director Comercial en grupo distribuidor automotriz. Escéptico de clics; quiere gente real en piso.',
  'Piso con menos gente',
  'Distribuidor automotriz — piso flojo, desconfía de métricas digitales sin visitas.',
  'Cliente media dificultad: validar escepticismo de clics, proponer medición de gente real.'
);

INSERT INTO scenario_problemas (scenario_id, descripcion, sort_order) VALUES
  (_scenario_id('efrain'), 'No cree en clics como indicador de venta', 1),
  (_scenario_id('efrain'), 'Piso con menos gente de la esperada', 2),
  (_scenario_id('efrain'), 'Leads digitales que no pisan la agencia', 3);

INSERT INTO scenario_claves (scenario_id, clave, sort_order) VALUES
  (_scenario_id('efrain'), 'Gente real en piso, no clics', 1),
  (_scenario_id('efrain'), 'Medición conjunta de visitas showroom', 2),
  (_scenario_id('efrain'), 'Reconocer escepticismo digital', 3),
  (_scenario_id('efrain'), 'Propuesta breve y medible', 4);

INSERT INTO scenario_saludos (scenario_id, saludo, difficulty_level, sort_order) VALUES
  (_scenario_id('efrain'), 'El piso está flojo. No me interesan los clics.', NULL, 1),
  (_scenario_id('efrain'), '¿Ustedes miden gente real o solo leads?', NULL, 2),
  (_scenario_id('efrain'), 'Si habla de clics, cuelgo.', 3, 1);

INSERT INTO scenario_round_prompts (scenario_id, round_type, prompt_cliente) VALUES
  (_scenario_id('efrain'), 'apertura', 'El piso está flojo. No me interesan los clics.'),
  (_scenario_id('efrain'), 'objecion', 'Eso ya lo escuché. ¿Qué resultado me trae en piso?'),
  (_scenario_id('efrain'), 'claridad', 'Explíqueme en una frase qué medirían en showroom.'),
  (_scenario_id('efrain'), 'correo', 'Mande su correo, pero sea breve.'),
  (_scenario_id('efrain'), 'cierre', 'Si no hay fecha en la agenda, no hay reunión.');

INSERT INTO scenario_reacciones (scenario_id, round_type, quality, reaccion) VALUES
  (_scenario_id('efrain'), 'apertura', 'bien', 'Gente en piso sí me importa. Continúe.'),
  (_scenario_id('efrain'), 'apertura', 'medio', '¿Ustedes miden gente real o solo leads?'),
  (_scenario_id('efrain'), 'apertura', 'mal', 'No me interesan los clics. Adiós.'),
  (_scenario_id('efrain'), 'objecion', 'bien', 'De acuerdo, hable de visitas reales.'),
  (_scenario_id('efrain'), 'objecion', 'medio', 'Eso ya lo escuché. ¿Qué resultado me trae?'),
  (_scenario_id('efrain'), 'objecion', 'mal', 'Suena a agencia de clics más.'),
  (_scenario_id('efrain'), 'claridad', 'bien', 'Eso tiene sentido. ¿Cómo lo medirían?'),
  (_scenario_id('efrain'), 'claridad', 'medio', 'Explíqueme en una frase qué medirían.'),
  (_scenario_id('efrain'), 'claridad', 'mal', 'No veo cómo ataca mi piso flojo.'),
  (_scenario_id('efrain'), 'correo', 'bien', 'Está bien, algo breve sobre piso.'),
  (_scenario_id('efrain'), 'correo', 'medio', 'Mande su correo, pero sea breve.'),
  (_scenario_id('efrain'), 'correo', 'mal', 'No quiero otro PDF de clics.');

INSERT INTO scenario_cierres (scenario_id, cierre, difficulty_level, sort_order) VALUES
  (_scenario_id('efrain'), 'Si no hay fecha en la agenda, no hay reunión.', NULL, 1),
  (_scenario_id('efrain'), 'Proponga día y hora o no hay reunión.', 3, 1);

SELECT _seed_scenario_frases('efrain');

-- Drop seed helpers (keep schema clean)
DROP FUNCTION _seed_scenario_frases(TEXT);
DROP FUNCTION _scenario_id(TEXT);
