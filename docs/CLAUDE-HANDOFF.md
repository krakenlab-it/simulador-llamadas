# Kraken Simulación / simulador-llamadas — Handoff completo para Claude

**Fecha:** 2026-09-15  
**Repo (público):** https://github.com/krakenlab-it/simulador-llamadas  
**PR activa:** https://github.com/krakenlab-it/simulador-llamadas/pull/35  
**Branch:** `cursor/kraken-lab-pasantes-mvp-22a8`  
**Preview Vercel:** https://simulador-llamadas-git-cursor-kraken-la-f2ba5d-kraken-lab-media.vercel.app  
**Producto UI:** “Simulador de Confianza” / flujo “Kraken Simulación”  
**Dueño:** Jaime Yepez (`JaimeYepezM`) — comunica en español (México / LatAm)  
**Objetivo del producto:** entrenar pasantes de ventas B2B con llamadas simuladas (voz/texto), cliente agentico + evaluador.

---

## 1. Qué debe hacer el sistema (spec de Jaime)

El prompt autoritativo del cliente está en:

- Repo: https://raw.githubusercontent.com/krakenlab-it/simulador-llamadas/cursor/kraken-lab-pasantes-mvp-22a8/docs/jaime-client-system-prompt.txt  
- También embebido: `lib/agentic/jaime-client-system-prompt.txt` + `.template.ts`

Incluye:

1. **PACK DEL ESCENARIO** (inyectado en runtime, no el ejemplo fijo de Ricardo Salazar)  
2. **MODO CLIENTE** — persona oral mexicana, objeciones, medidores silenciosos (confianza / interés / paciencia), canal voz vs texto  
3. **MODO EVALUADOR** — feedback al terminar o con `/evaluar`  
4. Comandos: `/evaluar`, `/reiniciar`  
5. **Canal voz:** NUNCA pedir que escriba (“puede escribir”, “máximo un párrafo”, PDF, etc.)

Clave agentica en UI: `1234` (gate “Capa agentica”).

---

## 2. Arquitectura relevante (dónde está el cerebro)

| Pieza | Path |
|--------|------|
| Prompt Jaime (build pack + system) | `lib/agentic/jaime-prompt.ts` |
| Character / evaluator runtime | `lib/agentic/character-runtime.ts` |
| Medidores emocionales | `lib/agentic/emotional-meters.ts` |
| Estado por llamada | `lib/agentic/agentic-session-store.ts` |
| Turno live (orquesta agentic vs templates) | `lib/scoring/live-turn.ts` |
| Bancos de respuesta Clínica (templates) | `lib/scoring/reactions.ts`, `lib/scoring/reaction-banks.ts` |
| LLM client replies | `lib/llm/client-replies.ts` |
| TTS ElevenLabs | `lib/voice/providers/elevenlabs.ts`, `lib/voice/agent-settings.ts` |
| Wizard Kraken | `app/components/.../KrakenLabWizard.tsx` (voz default) |
| Gate agentica | `app/components/agentic/AgenticGate.tsx` |
| Tests del prompt | `tests/agentic/jaime-prompt.test.ts` |

**Flujo de un turno (simplificado):**

1. `live-turn` arma reply templated vía `getClientReply` (siempre).  
2. Si `isAgenticSessionActive(config)` → `runAgenticReply(...)` con prompt Jaime + LLM.  
3. Si agentic OFF pero hay Groq → `generateGroqClientReply`.  
4. Si no hay LLM → se queda el **template** de Clínica/correo.

---

## 3. CI / deploy (estado técnico)

En PR #35 (último check conocido 2026-09-15):

- lint / typecheck / test / build: **PASS**  
- Vercel Preview: **PASS** (deployed)  
- Cursor Bugbot: neutral/skip  

**Importante:** CI verde ≠ producto correcto. Los tests unitarios verifican que el prompt *contiene* las reglas; no garantizan que en Preview el LLM esté activo ni que la UX deje de usar templates.

---

## 4. Historial de bugs ya “arreglados” en código (iteración 2026-09-08 → 09-15)

Lista no exhaustiva de lo que se tocó en PR #35:

- Wizard contraste / branding Simulador de Confianza  
- Catálogo / historial / Guardar escenario con fallbacks demo  
- Capa agentica + gate 1234 + `lib/agentic`  
- CV upload + autofill, localStorage draft, docs por proyecto  
- Industrias México (Retail, Consumo, Automotriz, Fast Food, Moda, Entretenimiento, Empresa de eventos, Empresas de eventos turismo/alimentos/tech, Banca, Seguros, Telecom, Turismo/Real Estate, ESG)  
- Fix loop cierre día/hora en español (“martes a las 10 de la mañana”)  
- Kraken modo **voz** por defecto + mic visible  
- Variación de guión Clínica por sesión (Mariana / Rodrigo / Efraín)  
- Prompt “humano” + ElevenLabs Laura / es-MX  
- **Instalación del prompt completo de Jaime** (pack live, medidores, `/evaluar`, `/reiniciar`)  
- Fix bancos correo: no “Puede escribir…” en voz  

---

## 5. Por qué Jaime sigue viendo fallas (causas raíz probables)

### A. Dual-path: templates siguen existiendo

Aunque el prompt Jaime esté instalado, si:

- la sesión **no** tiene capa agentica activa, o  
- **no hay** `GROQ_API_KEY` / `GOOGLE_API_KEY` en Preview,

el cliente cae a `getClientReply` / templates. Esas frases rígidas (correo, objeciones genéricas, “puede escribir”) son exactamente lo que el usuario percibe como “no trabaja”.

**Acción para Claude:** verificar en Vercel Preview que Preview env tenga `GROQ_API_KEY` o `GOOGLE_API_KEY` (mismo patrón que ya se hizo con ElevenLabs Preview). Sin LLM, el prompt Jaime no mueve la boca del cliente.

### B. Clínica vs Kraken

Clínica (Mariana/Rodrigo/Efraín) tiene bancos propios. Agentica debe activarse y ganar; si el gate no está ON o el seed no marca agentic, se oye el guión viejo.

### C. Prompt vs runtime incompleto

El prompt de Jaime describe medidores, etapas, evaluador. Parte ya está cableada (`emotional-meters`, session store, `/evaluar`). Puede faltar fidelidad total (ej. motor de objeciones por evento, hang-up exacto, coaching paralelo) — auditar `character-runtime.ts` + `live-turn.ts` contra el `.txt` línea a línea.

### D. Voz / TTS

ElevenLabs en Preview se habilitó; default Laura/es-MX. Si TTS falla, la UX cae a Web Speech o texto. Separar “falla de diálogo” vs “falla de voz”.

### E. Expectativa de producto

Jaime edita el prompt y espera que **reemplace** todo. Cualquier reply que no salga del LLM con ese system prompt se siente como regresión. La solución no es otro prompt más corto: es **forzar un solo camino LLM+Jaime** cuando agentica está ON, y fallar visible si no hay API key (en vez de template silencioso).

---

## 6. Recomendación de fix (prioridad)

1. **Hard requirement en Preview:** `GROQ_API_KEY` o `GOOGLE_API_KEY` en entorno Preview + Production.  
2. Cuando agentica ON y no hay LLM: devolver error/coaching claro (“Falta API key LLM”) — **no** template de Clínica.  
3. En `mode === "voz"`, bloquear a nivel código cualquier bank line con “escribir|párrafo|PDF|correo”.  
4. Diff `docs/jaime-client-system-prompt.txt` vs lo que realmente manda `buildJaimeClientSystemPrompt` + `buildCharacterPrompt` en un turno real (log server-side del system prompt en dev).  
5. E2E manual: Clínica + agentica 1234 + voz; Kraken custom + voz; `/evaluar`; `/reiniciar`.

---

## 7. Links útiles para Claude

| Qué | URL |
|-----|-----|
| PR #35 | https://github.com/krakenlab-it/simulador-llamadas/pull/35 |
| Prompt fuente | https://raw.githubusercontent.com/krakenlab-it/simulador-llamadas/cursor/kraken-lab-pasantes-mvp-22a8/docs/jaime-client-system-prompt.txt |
| `jaime-prompt.ts` | https://github.com/krakenlab-it/simulador-llamadas/blob/cursor/kraken-lab-pasantes-mvp-22a8/lib/agentic/jaime-prompt.ts |
| `character-runtime.ts` | https://github.com/krakenlab-it/simulador-llamadas/blob/cursor/kraken-lab-pasantes-mvp-22a8/lib/agentic/character-runtime.ts |
| `live-turn.ts` | https://github.com/krakenlab-it/simulador-llamadas/blob/cursor/kraken-lab-pasantes-mvp-22a8/lib/scoring/live-turn.ts |
| Tests | https://github.com/krakenlab-it/simulador-llamadas/blob/cursor/kraken-lab-pasantes-mvp-22a8/tests/agentic/jaime-prompt.test.ts |
| Preview | https://simulador-llamadas-git-cursor-kraken-la-f2ba5d-kraken-lab-media.vercel.app |
| .env.example | https://github.com/krakenlab-it/simulador-llamadas/blob/cursor/kraken-lab-pasantes-mvp-22a8/.env.example |

---

## 8. Pedido concreto a Claude

Diagnosticar y proponer (o implementar) el cambio mínimo para que:

1. Con capa agentica ON, **100%** de las replies del cliente salgan del prompt Jaime + LLM (cero templates silenciosos).  
2. Canal voz nunca pida escribir.  
3. El pack del escenario refleje el escenario real (Clínica o Kraken), no el ejemplo Taquería.  
4. `/evaluar` y fin de llamada usen MODO EVALUADOR del mismo documento.  
5. Documentar qué env vars faltan en Vercel Preview si el LLM no está activo.

Si necesitas logs de una llamada real, pedir a Jaime un transcript de la sesión fallida (texto de cada turno) + si tenía “Capa agentica” ON y modo voz/texto.
