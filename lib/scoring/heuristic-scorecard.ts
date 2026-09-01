import type { ScenarioConfig } from "@/lib/scenarios/types";
import {
  computeOverallScore,
  getDimensionLabel,
  scoreToHundred,
} from "./dimensions";
import { computeCallAnalytics, countQuestionTypes, detectNextStep } from "./analytics";
import {
  extractQuote,
  traineeTextFromTranscript,
  transcriptHasObjection,
} from "./transcript";
import { inferCallType } from "./outcome";
import type {
  CallScorecard,
  CallTypeOverlay,
  DimensionScore,
  ScoreDimensionId,
  TranscriptLine,
} from "./types";

export interface HeuristicScoreInput {
  lines: TranscriptLine[];
  config: ScenarioConfig | null;
  isPreset: boolean;
  callType?: CallTypeOverlay;
}

function clampStar(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score * 10) / 10));
}

function scoreApertura(text: string): number {
  let score = 2;
  if (/\b(soy|me llamo|mi nombre es)\b/i.test(text)) score += 0.8;
  if (/\b(permiso|un minuto|le robo|tiene sentido)\b/i.test(text)) score += 0.6;
  if (/\b(contexto|entiendo que|sé que)\b/i.test(text)) score += 0.6;
  if (text.length < 40) score -= 0.8;
  if (text.length > 600) score -= 0.5;
  return clampStar(score);
}

function scoreDiscovery(text: string): number {
  const questions = countQuestionTypes(text);
  const totalQuestions = questions.open + questions.closed + questions.clarifying;
  let score = 1.5 + Math.min(2.2, questions.open * 0.7 + questions.clarifying * 0.9);
  if (questions.closed > questions.open && totalQuestions > 2) score -= 0.4;
  if (/\b(cuénteme|explíqueme|ayúdeme a entender)\b/i.test(text)) score += 0.5;
  if (/\b(nosotros ofrecemos|nuestra plataforma|tenemos)\b/i.test(text) && totalQuestions < 2) {
    score -= 0.8;
  }
  return clampStar(score);
}

function scoreDolor(text: string, config: ScenarioConfig | null): number {
  let score = 2;
  const problem = config?.clientProblem ?? "";
  if (problem && text.toLowerCase().includes(problem.toLowerCase().slice(0, 12))) {
    score += 1;
  }
  if (/\b(problema|reto|dolor|impacto|consecuencia|costo de no)\b/i.test(text)) score += 0.8;
  if (/\b(¿qué pasa si|qué implica|cuánto le cuesta)\b/i.test(text)) score += 0.7;
  return clampStar(score);
}

function scoreValor(text: string, config: ScenarioConfig | null): number {
  let score = 2;
  const industry = config?.industry ?? "";
  const product = config?.productSold ?? "";
  const industryHit =
    industry.length > 3 &&
    industry
      .split(/\s+/)
      .some((w) => w.length > 4 && text.toLowerCase().includes(w.toLowerCase()));
  const productHit =
    product.length > 3 &&
    product
      .split(/\s+/)
      .some((w) => w.length > 4 && text.toLowerCase().includes(w.toLowerCase()));

  if (industryHit || productHit) score += 1.2;
  if (/\b(para usted|en su caso|en su operación|adaptado)\b/i.test(text)) score += 0.6;

  const featureDump =
    (text.match(/\b(tenemos|ofrecemos|incluye|módulo|función)\b/gi) ?? []).length;
  const questions = countQuestionTypes(text);
  if (featureDump >= 3 && questions.open < 2) score -= 1.2;

  return clampStar(score);
}

function scoreObjecion(text: string, lines: TranscriptLine[]): number {
  const clientObjection = lines
    .filter((l) => l.role === "client")
    .some((l) =>
      /\b(caro|tiempo|no me interesa|ya tengo|presupuesto|ocupado|no confío)\b/i.test(l.text),
    );
  if (!clientObjection) return 3;

  let score = 1.5;
  if (/\b(entiendo|comprendo|tiene razón|es válido|fair)\b/i.test(text)) score += 1.2;
  if (/\b(pero escuche|déjeme|antes de|permítame)\b/i.test(text)) score += 0.4;
  if (/\b(no es para usted|no califica|eso no importa)\b/i.test(text)) score -= 1.5;
  if (text.length > 0 && !/\b(entiendo|comprendo|veo)\b/i.test(text)) score -= 0.8;
  return clampStar(score);
}

function scoreCierre(text: string): number {
  let score = 1.5;
  if (detectNextStep(text)) score += 2;
  if (/\b(próxima semana|en algún momento|cuando pueda|vemos qué)\b/i.test(text)) {
    score -= 1;
  }
  if (/\b(martes|miércoles|jueves|viernes|lunes|mañana|\d{1,2}:\d{2}|a las \d)\b/i.test(text)) {
    score += 0.8;
  }
  return clampStar(score);
}

export function scoreTranscriptHeuristic(
  input: HeuristicScoreInput,
): CallScorecard {
  const traineeText = traineeTextFromTranscript(input.lines);
  const objectionApplicable = transcriptHasObjection(input.lines);
  const callType = input.callType ?? inferCallType(input.config, input.isPreset);
  const analytics = computeCallAnalytics(input.lines);

  const rawScores: Record<ScoreDimensionId, number> = {
    apertura_contrato: scoreApertura(traineeText),
    discovery_escucha: scoreDiscovery(traineeText),
    dolor_implicacion: scoreDolor(traineeText, input.config),
    valor_tailor: scoreValor(traineeText, input.config),
    compostura_objecion: objectionApplicable
      ? scoreObjecion(traineeText, input.lines)
      : 3,
    cierre_siguiente_paso: scoreCierre(traineeText),
  };

  const dimensions: DimensionScore[] = (
    Object.entries(rawScores) as [ScoreDimensionId, number][]
  ).map(([id, score]) => ({
    id,
    label: getDimensionLabel(id),
    score,
    rationale: buildRationale(id, score, objectionApplicable),
    notApplicable: id === "compostura_objecion" && !objectionApplicable,
  }));

  const applicable = dimensions.filter((d) => !d.notApplicable);
  const { overallScore, overallStars } = computeOverallScore(
    applicable,
    callType,
    objectionApplicable,
  );

  return {
    dimensions,
    overallScore,
    overallStars,
    callType,
    analytics,
  };
}

function buildRationale(
  id: ScoreDimensionId,
  score: number,
  objectionApplicable: boolean,
): string {
  if (id === "compostura_objecion" && !objectionApplicable) {
    return "Sin objeción del comprador en esta llamada; dimensión no aplicable.";
  }
  if (score >= 4) return `Fortaleza clara en ${getDimensionLabel(id).toLowerCase()}.`;
  if (score >= 3) return `Desempeño aceptable en ${getDimensionLabel(id).toLowerCase()}.`;
  return `Brecha principal en ${getDimensionLabel(id).toLowerCase()}.`;
}

export function pickStrengthQuote(lines: TranscriptLine[]): string {
  const traineeLines = lines.filter((l) => l.role === "trainee");
  const best = traineeLines.find((l) => countQuestionTypes(l.text).open > 0) ??
    traineeLines.find((l) => l.text.length > 40) ??
    traineeLines[traineeLines.length - 1];
  return extractQuote(best?.text ?? "");
}

export function pickGapQuote(lines: TranscriptLine[]): string {
  const traineeLines = lines.filter((l) => l.role === "trainee");
  const weak =
    traineeLines.find((l) => detectNextStep(l.text) === false && l.text.length > 30) ??
    traineeLines[traineeLines.length - 1];
  return extractQuote(weak?.text ?? "");
}

export function dimensionHundred(dim: DimensionScore): number {
  if (dim.notApplicable) return 0;
  return scoreToHundred(dim.score);
}
