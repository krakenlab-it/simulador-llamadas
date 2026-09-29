import { callLlm, isLlmAvailable } from "@/lib/llm/provider";
import type { ScenarioAuthoringDraft } from "./authoring";
import { defaultDimensionGuides } from "./authoring";
import { buildDefaultRounds } from "./defaults";
import { defaultDifficultyEtiqueta } from "./difficulty-etiquette";
import { defaultTemperamentFromList } from "./temperament-options";
import type { ScenarioRoundDef } from "./types";

export interface AuthoringAutofillInput {
  industry: string;
  productSold: string;
  clientName: string;
  clientTitle: string;
  companyContext: string;
  clientProblem: string;
  language: ScenarioAuthoringDraft["language"];
  callType: ScenarioAuthoringDraft["callType"];
  temperament?: string;
  difficultyLabel?: string;
}

function coachPressureForPhase(
  phaseKey: string,
  input: AuthoringAutofillInput,
  objection: string,
): string {
  switch (phaseKey) {
    case "apertura":
      return "Poco tiempo; pide quién llama y por qué le importa ahora.";
    case "objecion":
      return objection || `Duda el valor frente a lo que ya hace en ${input.industry}.`;
    case "claridad":
      return "Exige una frase clara de impacto medible; no promesas vagas.";
    case "correo":
      return "Pide algo breve por correo antes de comprometerse.";
    case "cierre":
      return "No cede día y hora sin ver prueba concreta del siguiente paso.";
    default:
      return "Mantiene la guardia alta; una sola duda concreta.";
  }
}

export function buildDeterministicAuthoringAutofill(
  input: AuthoringAutofillInput,
): Partial<ScenarioAuthoringDraft> {
  const temperament =
    input.temperament?.trim() || defaultTemperamentFromList(input.language);
  const objections = [
    `Ya tenemos algo parecido en ${input.industry || "el negocio"}.`,
    "No tengo presupuesto ahorita.",
    "¿Qué resultado me garantizan en el primer mes?",
    "Mándame info y lo veo con mi equipo.",
  ];

  const baseRounds = buildDefaultRounds(
    input.industry,
    input.productSold,
    input.clientProblem,
    temperament,
  );

  const rounds: ScenarioRoundDef[] = baseRounds.map((round) => ({
    ...round,
    goal: round.goal,
    clientPrompt: coachPressureForPhase(
      round.key,
      input,
      objections[round.key === "objecion" ? 0 : 1] ?? objections[0],
    ),
    whatGoodLooksLike:
      round.key === "apertura"
        ? "Presentación corta + permiso + enganche con el dolor real, sin pitch largo."
        : round.key === "cierre"
          ? "Propone día y hora concretos alineados al éxito del caso."
          : "Valida la duda y conecta con el mundo del cliente, no con jerga genérica.",
  }));

  const winCriteria =
    input.language === "en"
      ? "Concrete next step with day and time (not a vague «let's meet»)."
      : "Siguiente paso concreto con día y hora (no solo «reunión» genérica).";

  return {
    temperament,
    difficultyLabel:
      input.difficultyLabel?.trim() ||
      defaultDifficultyEtiqueta(input.language),
    objections,
    winCriteria,
    rounds,
    dimensionGuides: defaultDimensionGuides(input.language),
  };
}

const AUTOFILL_SCHEMA_HINT = `Responde SOLO JSON válido con esta forma:
{
  "objections": ["...", "...", "...", "..."],
  "winCriteria": "...",
  "rounds": [
    { "label": "...", "goal": "...", "clientPrompt": "...", "whatGoodLooksLike": "..." }
  ]
}
clientPrompt = presión/psicología del comprador para el coach (NO diálogo literal).
rounds: entre 3 y 7 fases realistas para una llamada de ventas.`;

export async function autofillAuthoringDraft(
  draft: ScenarioAuthoringDraft,
): Promise<Partial<ScenarioAuthoringDraft>> {
  const fallback = buildDeterministicAuthoringAutofill({
    industry: draft.industry,
    productSold: draft.productSold,
    clientName: draft.clientName,
    clientTitle: draft.clientTitle,
    companyContext: draft.companyContext,
    clientProblem: draft.clientProblem,
    language: draft.language,
    callType: draft.callType,
    temperament: draft.temperament,
    difficultyLabel: draft.difficultyLabel,
  });

  if (!isLlmAvailable()) return fallback;

  const prompt = `Eres coach de un contact center en México. Completa el perfil de entrenamiento (NO guion de diálogo).

Cliente: ${draft.clientName}, ${draft.clientTitle} en ${draft.companyContext}.
Industria: ${draft.industry}. Venden: ${draft.productSold}.
Problema real: ${draft.clientProblem}.
Temperamento: ${draft.temperament}. Dificultad: ${draft.difficultyLabel}.
Tipo de llamada: ${draft.callType}. Idioma: ${draft.language}.

${AUTOFILL_SCHEMA_HINT}`;

  const raw = await callLlm(prompt, { maxTokens: 900, temperature: 0.55 });
  if (!raw) return fallback;

  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return fallback;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
      objections?: string[];
      winCriteria?: string;
      rounds?: Array<{
        label?: string;
        goal?: string;
        clientPrompt?: string;
        whatGoodLooksLike?: string;
      }>;
    };

    const mergedRounds =
      parsed.rounds && parsed.rounds.length >= 3
        ? parsed.rounds.map((round, index) => {
            const base = fallback.rounds?.[index];
            return {
              key: base?.key ?? `fase-${index + 1}`,
              label: round.label?.trim() || base?.label || `Fase ${index + 1}`,
              goal: round.goal?.trim() || base?.goal || "",
              clientPrompt: round.clientPrompt?.trim() || base?.clientPrompt || "",
              whatGoodLooksLike:
                round.whatGoodLooksLike?.trim() || base?.whatGoodLooksLike,
              positiveCriteria: base?.positiveCriteria ?? [],
              negativeCriteria: base?.negativeCriteria ?? [],
            };
          })
        : fallback.rounds;

    return {
      objections:
        parsed.objections?.filter(Boolean).slice(0, 6) ?? fallback.objections,
      winCriteria: parsed.winCriteria?.trim() || fallback.winCriteria,
      rounds: mergedRounds,
      dimensionGuides: fallback.dimensionGuides,
    };
  } catch {
    return fallback;
  }
}
