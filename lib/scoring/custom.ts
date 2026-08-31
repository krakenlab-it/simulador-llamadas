import type { DifficultyLevel } from "@/lib/db/types";
import { DAY_PATTERN, TIME_PATTERN } from "@/lib/scoring/keywords";
import type { ClientReaction } from "@/lib/scoring/rondas";
import type {
  RichTurnFeedback,
  ScenarioConfig,
  ScenarioRoundDef,
} from "@/lib/scenarios/types";

export interface CustomAnalisisResult {
  hits: Record<string, boolean>;
  hasDay: boolean;
  hasTime: boolean;
}

export interface CustomScoreResult {
  keywordHits: Record<string, boolean>;
  roundScore: number;
  feedback: string;
  reaction: ClientReaction;
  won: boolean;
  hasConcreteDayAndTime: boolean;
  richFeedback: RichTurnFeedback;
}

function reactionFromScore(score: number): ClientReaction {
  if (score >= 55) return "bien";
  if (score >= 30) return "medio";
  return "mal";
}

export function analizarCustom(
  utterance: string,
  config: ScenarioConfig,
): CustomAnalisisResult {
  const hits: Record<string, boolean> = {};

  for (const criterion of config.criteria) {
    try {
      hits[criterion.id] = new RegExp(criterion.pattern, "i").test(utterance);
    } catch {
      hits[criterion.id] = utterance.toLowerCase().includes(criterion.label.toLowerCase());
    }
  }

  return {
    hits,
    hasDay: DAY_PATTERN.test(utterance),
    hasTime: TIME_PATTERN.test(utterance),
  };
}

function getCriterionLabel(config: ScenarioConfig, id: string): string {
  return config.criteria.find((c) => c.id === id)?.label ?? id;
}

function computeCustomScore(
  analisis: CustomAnalisisResult,
  round: ScenarioRoundDef,
  config: ScenarioConfig,
): { score: number; missed: string[]; hitLabels: string[] } {
  const roundPositiveHits = round.positiveCriteria.filter(
    (id) => analisis.hits[id],
  );
  const globalPositiveHits = config.globalPositiveCriteria.filter(
    (id) => analisis.hits[id],
  );
  const positives = Math.max(roundPositiveHits.length, globalPositiveHits.length);
  const negatives = round.negativeCriteria.filter((id) => analisis.hits[id]).length;
  const score = Math.max(0, Math.min(100, positives * 14 - negatives * 10));

  const missed = round.positiveCriteria
    .filter((id) => !analisis.hits[id])
    .map((id) => getCriterionLabel(config, id));

  const hitLabels = [...roundPositiveHits, ...globalPositiveHits]
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => getCriterionLabel(config, id));

  return { score, missed, hitLabels };
}

function evaluateCustomWin(
  analisis: CustomAnalisisResult,
  round: ScenarioRoundDef,
  difficultyLevel: DifficultyLevel,
  isLastRound: boolean,
): boolean {
  if (!isLastRound) return false;

  const hasReunion = analisis.hits.reunion;
  if (difficultyLevel === 1) {
    return hasReunion && (analisis.hasDay || analisis.hits.dia_hora);
  }
  return hasReunion && analisis.hasDay && analisis.hasTime;
}

function buildWhyScore(
  score: number,
  hitLabels: string[],
  missed: string[],
  round: ScenarioRoundDef,
): string {
  if (score >= 55) {
    return `Buen manejo de ${round.label.toLowerCase()}: detectamos ${hitLabels.join(", ") || "lenguaje relevante"}.`;
  }
  if (score >= 30) {
    return `Respuesta parcial en ${round.label.toLowerCase()}. Faltó profundizar${missed.length ? `: ${missed.join(", ")}` : "."}`;
  }
  return `Respuesta débil en ${round.label.toLowerCase()}. No abordaste ${missed.slice(0, 2).join(" ni ") || "los criterios clave"}.`;
}

function buildStrongerLine(
  round: ScenarioRoundDef,
  config: ScenarioConfig,
  missed: string[],
  clientName: string,
): string {
  const missedHint = missed.length > 0 ? `Mencione ${missed[0]}` : "Sea más concreto";
  const templates: Record<string, string> = {
    apertura: `${clientName}, entiendo su reto con ${config.clientProblem}. ${missedHint} y proponga cómo medirían el avance en ${config.industry}.`,
    objecion: `Tiene razón en dudar. En ${config.industry} medimos ${config.productSold} con métricas claras, sin descalificar su operación.`,
    claridad: `El problema concreto es ${config.clientProblem}; mediríamos juntos el impacto en ${config.winCriteria}.`,
    correo: `Con su permiso le envío un resumen breve sobre ${config.productSold} para agendar una reunión.`,
    cierre: `¿Le parece el martes a las 10:30 para revisar cómo atacar ${config.clientProblem}?`,
  };

  return templates[round.key] ?? `${missedHint} en ${round.label}: ${round.goal}`;
}

export function scoreCustomTurn(input: {
  utterance: string;
  round: ScenarioRoundDef;
  config: ScenarioConfig;
  difficultyLevel: DifficultyLevel;
  clientName: string;
  isLastRound: boolean;
}): CustomScoreResult {
  const analisis = analizarCustom(input.utterance, input.config);
  const { score, missed, hitLabels } = computeCustomScore(
    analisis,
    input.round,
    input.config,
  );
  const reaction = reactionFromScore(score);
  const hasConcreteDayAndTime = analisis.hasDay && analisis.hasTime;
  const won = evaluateCustomWin(
    analisis,
    input.round,
    input.difficultyLevel,
    input.isLastRound,
  );

  const whyScore = buildWhyScore(score, hitLabels, missed, input.round);
  const strongerLine = buildStrongerLine(
    input.round,
    input.config,
    missed,
    input.clientName,
  );

  return {
    keywordHits: analisis.hits,
    roundScore: score,
    feedback: input.round.goal,
    reaction,
    won,
    hasConcreteDayAndTime,
    richFeedback: {
      score,
      utterance: input.utterance,
      whyScore,
      strongerLine,
      missedCriteria: missed,
      roundLabel: input.round.label,
    },
  };
}
