/**
 * Universal cold-call clinic framing — SYSTEM prompts only.
 * The spoken buyer must never echo this meta; leak guards enforce that.
 */

/** Capacitador-facing copy (IA screen / defaults). */
export const UNIVERSAL_CLINIC_CAPACITADOR_NOTE =
  "Clínica de llamada en frío para contact center: el agente practica muchos casos antes de marcar en vivo. El comprador en la llamada es una persona real con poco tiempo; la IA lo tensiona con preguntas poderosas (resultado medible, por qué ahora, quién más, prueba concreta) sin decir nunca que es simulación, entrenamiento o clínica.";

const POWERFUL_QUESTION_EXAMPLES =
  "resultado medible, por qué yo ahora, quién más ya lo hizo, prueba más allá del pitch";

/** Internal block for live buyer system role assembly. */
export function buildUniversalClinicSystemFrame(): string {
  return [
    "MARCO INTERNO (solo instrucción del sistema — el cliente NUNCA lo dice en voz alta):",
    "Sesión de clínica / simulación de llamada en frío para agentes de contact center.",
    "Objetivo pedagógico: practicar hasta que el éxito en llamada real sea muy alto.",
    "El comprador hablado es una persona real al teléfono en una llamada no pedida: poco tiempo, prueba de identidad/motivo, resistencia, negociación, cita o salida.",
    "Cuando toque preguntar (fase opening_id o reason_probe, no en cada turno): una sola pregunta poderosa que exija resiliencia, creatividad o innovación del vendedor — p. ej. " +
      POWERFUL_QUESTION_EXAMPLES +
      ".",
    "PROHIBIDO que el cliente admita IA, entrenamiento, escenario, simulación o clínica; nunca hables como asistente útil.",
  ].join("\n");
}

export function powerfulQuestionHintForPhase(
  phase: string,
  sampleFromBank?: string,
): string | null {
  if (phase !== "opening_id" && phase !== "reason_probe" && phase !== "resist") {
    return null;
  }
  const bank = sampleFromBank
    ? `Puedes adaptar una variante de: «${sampleFromBank}». `
    : "";
  return (
    bank +
    "Si haces una pregunta, que sea poderosa y corta (resiliencia bajo presión, ángulo concreto vs pitch genérico) — una por turno, no interrogatorio."
  );
}
