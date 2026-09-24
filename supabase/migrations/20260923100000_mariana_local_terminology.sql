-- Trainee-facing copy: «caseta» → «local» for Mariana (desarrollo inmobiliario).
-- Forward-only; aligns seeded clinic rows with lib/scenarios/catalog-presets.ts.

UPDATE scenarios
SET indicator = 'Visitas al local'
WHERE slug = 'mariana' AND indicator = 'Visitas a caseta';

UPDATE scenario_fichas
SET
  resumen = 'Directora de Mercadotecnia en desarrolladora de vivienda media. Presionada por costo por prospecto y local sin tráfico calificado.',
  indicador_clave = 'Visitas al local',
  contexto_negocio = 'Desarrolladora de vivienda media — campañas offline (espectaculares, local) con poca medición.',
  notas_formador = 'Cliente difícil: valida indicador antes de escuchar propuesta. Evitar pitch genérico de agencia.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana');

UPDATE scenario_problemas
SET descripcion = 'Formularios que no visitan el local'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND descripcion = 'Formularios que no visitan caseta';

UPDATE scenario_claves
SET clave = 'Hablar en visitas al local, no en branding'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND clave = 'Hablar en visitas a caseta, no en branding';

UPDATE scenario_claves
SET clave = 'Reconocer que ya tienen agencia y local'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND clave = 'Reconocer que ya tienen agencia y caseta';

UPDATE scenario_saludos
SET saludo = 'Ya tenemos agencia y local. No busco otra cosa.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND saludo = 'Ya tenemos agencia y caseta. No busco otra cosa.';

UPDATE scenario_saludos
SET saludo = 'Si es otro discurso del local, cuelgo.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND saludo = 'Si es otro discurso de caseta, cuelgo.';

UPDATE scenario_round_prompts
SET prompt_cliente = 'Eso ya lo escuché. ¿Qué resultado me trae al local?'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND round_type = 'objecion'
  AND prompt_cliente = 'Eso ya lo escuché. ¿Qué resultado me trae a caseta?';

UPDATE scenario_round_prompts
SET prompt_cliente = 'Explíqueme en una frase qué medirían en visitas al local.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND round_type = 'claridad'
  AND prompt_cliente = 'Explíqueme en una frase qué medirían en visitas a caseta.';

UPDATE scenario_reacciones
SET reaccion = 'De acuerdo, las visitas al local sí me importan. Siga.'
WHERE scenario_id = (SELECT id FROM scenarios WHERE slug = 'mariana')
  AND round_type = 'apertura'
  AND quality = 'bien'
  AND reaccion = 'De acuerdo, las visitas a caseta sí me importan. Siga.';
