## Simulador de Llamadas

**Clínica de Citas · Simulador de llamada** — herramienta de formación comercial para practicar llamadas en frío contra tres clientes simulados. Interfaz en español; el vendedor elige cliente, modo (voz o texto) y nivel de dificultad (1, 2 o 3), completa cinco turnos de llamada y recibe evaluación con la frase que debió decir. Solo gana si cierra con **día y hora concretos**.

> **Este PR (cornerstone)** entrega infraestructura, esquema de base de datos, CI y esqueleto de app. No incluye API completa, motor de voz en producción ni UI pulida.

### Qué incluye este repositorio

| Área | Estado en este PR |
|------|-------------------|
| Esqueleto Next.js 15 (TypeScript) | ✅ Placeholder en `/` |
| Esquema SQL (Supabase/Postgres) | ✅ `supabase/migrations/` |
| Prototipo HTML de referencia | ✅ `docs/prototype/` |
| CI (lint, typecheck, test, build) | ✅ `.github/workflows/ci.yml` |
| Puntos de extensión documentados | ✅ `lib/extension-points/` |
| API / scoring servidor / pantallas UI | ⏳ PRs posteriores |

### Flujo del producto (MVP)

1. **Elegir cliente** — uno de tres perfiles fijos (no agregar más en v1).
2. **Configurar** — modo `voz` \| `texto` y nivel `1` \| `2` \| `3`.
3. **Cinco turnos** — apertura → objeción → claridad → correo → cierre.
4. **Colgar y evaluar** — análisis por palabras clave y frase esperada.
5. **Victoria** — solo si en el cierre propone reunión con día **y** hora específicos.

#### Los tres clientes

| Cliente | Rol | Contexto | Dificultad | Indicador |
|---------|-----|----------|------------|-----------|
| **Mariana Escobedo** | Directora de Mercadotecnia | Desarrolladora de vivienda media | Difícil | Visitas a caseta |
| **Rodrigo Nava** | Gerente de Medios | Cadena nacional de farmacias | Muy difícil | Tráfico a tienda / venta por m² |
| **Efraín Loera** | Director Comercial | Grupo distribuidor automotriz | Media | Piso con menos gente |

El prototipo interactivo (Web Speech API + `localStorage`) está en:

`docs/prototype/Clinica-de-Citas-Simulador-de-Llamada.html`

Abre ese archivo en el navegador para ver la UX de referencia. La UI de producción replicará ese flujo con persistencia en servidor.

### Cómo correr en local

**Requisitos:** Node.js 22+, npm, Postgres 15+ (o Supabase CLI para stack local).

```bash
# 1. Dependencias
npm ci

# 2. Variables de entorno (solo nombres — sin secretos en el repo)
cp .env.example .env.local
# Completar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Aplicar migraciones (con Supabase CLI)
npx supabase db reset   # o: supabase migration up

# 4. Desarrollo
npm run dev
# → http://localhost:3000
```

**Scripts útiles**

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run test` | Tests (esquema + extension points) |
| `npm run ci` | Pipeline local: lint + typecheck + test |

### Variables de entorno (nombres)

Ver `.env.example`. Nunca commitear valores reales.

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo servidor) |
| `DATABASE_URL` | Postgres directo (tests de migración en CI) |
| `ELEVENLABS_CONVAI_ENABLED` | Opt-in del agente ConvAI (vacío = llamada con micrófono del navegador + TTS) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app |

### Esquema de base de datos

Migración inicial: `supabase/migrations/20250831000000_initial_schema.sql`

```
trainees          → usuarios en entrenamiento
scenarios         → 3 clientes (seed fijo)
call_attempts     → intentos de llamada (nivel 1|2|3, modo voz|texto)
call_turns        → 5 turnos por llamada
turn_scores       → puntuación por ronda (keywords JSON)
call_history (vista) → historial agregado (reemplaza localStorage clinicav2:historial)
```

**Palabras clave de scoring:** problema, medición, jerga, reconocimiento, descalifica, gratis, reunión, día/hora, monólogo, telegrama.

**Asignación de ronda:** `allocate_call_turn()` (migración `20250901000000`) reserva el `round_number` con un lock sobre `call_attempts`, así dos envíos simultáneos nunca reciben el mismo número. Cada envío lleva un `client_turn_id`: si se reintenta, el servidor devuelve el turno ya guardado en vez de crear otra ronda.

### Cómo habla el cliente simulado

1. Entrada de voz: Web Speech API del navegador.
2. Un `POST /api/sessions/:id/turns` por ronda; ahí vuelven la puntuación y la respuesta del cliente.
3. Salida de voz: TTS de ElevenLabs por `/api/voice/tts` cuando la sesión de voz facturada está activa; voz del navegador si no.

El agente ConvAI es opcional (`ELEVENLABS_CONVAI_ENABLED=true`) y solo se hace cargo del audio mientras está conectado. Apagado, la llamada funciona igual.

### Puntos de extensión

| Archivo | PR siguiente |
|---------|----------------|
| `lib/extension-points/api.ts` | Rutas API: sesiones, turnos, historial |
| `lib/extension-points/scoring.ts` | Reglas de puntuación servidor |
| `lib/extension-points/session.ts` | Ciclo de llamada + Web Speech en cliente |
| `lib/db/types.ts` | Tipos alineados al esquema |
| `lib/supabase/client.ts` | Clientes Supabase browser/server |

### Cómo apilar PRs posteriores

Orden recomendado para no bloquear a Elon ni al equipo:

1. **Este PR** — infra + esquema + CI + prototipo en docs + README.
2. **Schema extras** — índices, RLS por trainee autenticado, triggers `updated_at`.
3. **API** — `POST /api/sessions`, turnos, fin de llamada, `GET /api/history`.
4. **Backend scoring** — portar lógica de keywords del prototipo; regla de victoria día+hora.
5. **Frontend screens** — pantallas del flujo (cliente → config → llamada → evaluación → historial).
6. **UI polish** — diseño final, accesibilidad, estados de carga, i18n fino.

Cada PR debe mantener CI verde (`npm run ci`) antes de push.

### Tests

- `tests/schema/migration.test.ts` — validación estática del SQL.
- `tests/schema/migration.integration.test.ts` — aplica migración a Postgres (`DATABASE_URL`).
- `tests/extension-points/` — scoring y sesión (placeholders).

### Stack

- [Next.js](https://nextjs.org/) 15 · [Supabase](https://supabase.com/) · [Vercel](https://vercel.com/) (deploy futuro)
- TypeScript, ESLint, Vitest, GitHub Actions

### Licencia / notas

Prototipo HTML reconstruido desde la especificación del producto (referencia interna). No incluye secretos ni integraciones de pago.
