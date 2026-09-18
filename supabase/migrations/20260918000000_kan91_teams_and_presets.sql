-- KAN-91: practice teams + same-test comparison, and stronger PREFILLED copy.
-- Does not INSERT new scenarios (clinic still seeds exactly three rows).

CREATE TABLE practice_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE practice_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES practice_teams(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE practice_team_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES practice_teams(id) ON DELETE CASCADE,
  scenario_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE practice_team_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES practice_team_tests(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES practice_team_members(id) ON DELETE CASCADE,
  call_attempt_id UUID,
  total_score INTEGER NOT NULL,
  won BOOLEAN NOT NULL DEFAULT false,
  turns_completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, member_id)
);

CREATE INDEX IF NOT EXISTS practice_team_members_team_idx
  ON practice_team_members (team_id);
CREATE INDEX IF NOT EXISTS practice_team_tests_team_idx
  ON practice_team_tests (team_id);
CREATE INDEX IF NOT EXISTS practice_team_results_test_idx
  ON practice_team_results (test_id);

COMMENT ON TABLE practice_teams IS 'KAN-91 practice teams for same-test comparison.';
COMMENT ON TABLE practice_team_tests IS 'One shared exam (same scenario) for a team.';

-- Stronger PREFILLED briefs. Names and slugs stay stable.
UPDATE scenarios
SET
  industry = 'Desarrollo inmobiliario de vivienda media',
  product_sold = 'Atribución de visitas a caseta y costo por prospecto calificado',
  temperament = 'Escéptica, entre juntas, ya tiene agencia',
  client_problem = 'Costo por prospecto +40%. Formularios que no visitan. Espectaculares sin medición.',
  objections = ARRAY[
    'Ya tenemos agencia y caseta; no voy a pagar otro retainer.',
    'Los formularios suben y la caseta sigue vacía.',
    'Si no me dices cómo mides una visita real, cuelgo.'
  ],
  win_criteria = 'Agenda una revisión de 25 minutos el jueves o viernes, con hora concreta, para ver el tablero de visitas a caseta.',
  config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
    'industry', 'Desarrollo inmobiliario de vivienda media',
    'productSold', 'Atribución de visitas a caseta y costo por prospecto calificado',
    'practiceBrief', 'Practica atribuir visitas reales a caseta — no un pitch de branding.'
  )
WHERE slug = 'mariana';

UPDATE scenarios
SET
  industry = 'Retail de farmacias de proximidad',
  product_sold = 'Incremento de tráfico a tienda y venta por metro cuadrado',
  temperament = 'Impaciente, corta branding, exige piso',
  client_problem = 'Aperturas de proximidad que no levantan',
  objections = ARRAY[
    'Las aperturas de proximidad no levantan y ya pagué awareness.',
    'Si no mueve venta por m², no me sirve.',
    'No voy a oír otro discurso de marca nacional.'
  ],
  win_criteria = 'Deja un slot de 20 minutos el lunes o martes, con hora, para revisar el plan de dos aperturas de proximidad.',
  config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
    'industry', 'Retail de farmacias de proximidad',
    'productSold', 'Incremento de tráfico a tienda y venta por metro cuadrado',
    'practiceBrief', 'Practica vender tráfico a tienda y venta por m².'
  )
WHERE slug = 'rodrigo';

UPDATE scenarios
SET
  industry = 'Distribución automotriz y piso de ventas',
  product_sold = 'Gente real en showroom y citas que sí llegan al piso',
  temperament = 'Directo, desconfía de clics, habla de piso',
  client_problem = 'No cree en clics. El piso está flojo.',
  objections = ARRAY[
    'El piso está flojo y marketing me presume clics.',
    'Los leads no se aparecen en el showroom.',
    'Si no hay gente real el sábado, el reporte no me sirve.'
  ],
  win_criteria = 'Acepta una visita o llamada el miércoles, con hora, para ver el plan de gente en piso — no un reporte de leads.',
  config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
    'industry', 'Distribución automotriz y piso de ventas',
    'productSold', 'Gente real en showroom y citas que sí llegan al piso',
    'practiceBrief', 'Practica traducir digital a gente en el showroom.'
  )
WHERE slug = 'efrain';

UPDATE scenario_fichas
SET
  resumen = 'Directora de Mercadotecnia. El CAC subió 40% y la caseta no recibe visitas calificadas. Ya tiene agencia.',
  notas_formador = 'No pitch de branding. Hablar visitas a caseta, CAC y tablero semanal. Éxito = día y hora para revisar el tablero.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana');

UPDATE scenario_fichas
SET
  resumen = 'Gerente de Medios de farmacias. Las aperturas de proximidad no levantan. Cuelga si oye branding.',
  notas_formador = 'Idioma de piso: tráfico a tienda y venta por m². Éxito = slot lunes/martes con hora.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'rodrigo');

UPDATE scenario_fichas
SET
  resumen = 'Director Comercial automotriz. El piso está flojo. No cree en clics ni en leads que no cruzan la puerta.',
  notas_formador = 'Traducir digital a cabezas en showroom. Éxito = miércoles con hora para el plan de piso.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'efrain');
