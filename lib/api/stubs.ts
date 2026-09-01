import type {
  CallStatus,
  DifficultyLevel,
  PracticeMode,
  RoundType,
} from "@/lib/db/types";
import { getRoundTypeForNumber } from "@/lib/extension-points/session";
import { CLINIC_PHASE_COUNT } from "@/lib/simulation/rounds";
import { resolveRoundKey } from "@/lib/simulation/round-keys";
import { SESSION_MAX_TURN_ALLOCATIONS } from "@/lib/voice/brakes";
import { getClientBySlug } from "@/lib/clients";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import type {
  CreateCustomScenarioInput,
  RichTurnFeedback,
  ScenarioRecord,
  SessionEvaluationSummary,
} from "@/lib/scenarios/types";
import { buildSessionEvaluation } from "@/lib/feedback/evaluation";
import { scoreTurnAdaptive } from "@/lib/scoring/adaptive";
import { scoreCall } from "@/lib/scoring/score-call";
import { buildTranscriptFromTurns } from "@/lib/scoring/transcript";
import type { ClientReaction } from "@/lib/scoring/rondas";
import { resolveEndSessionWin } from "@/lib/session/win";
import { DEFAULT_WIN_CRITERIA } from "@/lib/scoring/outcome";
import { getOpeningLine } from "@/lib/llm/client-replies";

export interface CreateSessionRequest {
  scenarioSlug: string;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  traineeId?: string;
  traineeDisplayName?: string;
}

export interface HistoryEntry {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  clientName: string;
  difficultyLevel: DifficultyLevel;
  mode: PracticeMode;
  status: CallStatus;
  won: boolean | null;
  totalScore: number | null;
  startedAt: string;
  endedAt: string | null;
  turnsCompleted: number;
}

export interface SessionResponse {
  callAttemptId: string;
  traineeId: string;
  scenarioSlug: string;
  clientName: string;
  isPreset: boolean;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  status: CallStatus;
  currentRound: number;
  totalRounds: number;
}

export interface TurnRequest {
  utterance: string;
  /** Idempotency key for one submit action; a retry of the same turn reuses it. */
  clientTurnId?: string;
}

export interface TurnResponse {
  turnId: string;
  roundNumber: number;
  roundType: RoundType;
  roundKey: string;
  roundLabel: string;
  traineeUtterance: string;
  roundScore: number;
  keywordHits: Record<string, boolean>;
  clientReaction: ClientReaction;
  clientReply: string;
  feedback: string;
  richFeedback: RichTurnFeedback;
  hasConcreteDayAndTime: boolean;
  won: boolean;
}

export interface TurnSummary {
  roundKey: string;
  roundLabel: string;
  roundType: RoundType | null;
  utterance: string;
  expectedPhrase: string;
  roundScore: number;
  richFeedback: RichTurnFeedback;
  keywordHits?: Record<string, boolean>;
}

export interface EndSessionResponse {
  callAttemptId: string;
  status: CallStatus;
  won: boolean;
  totalScore: number;
  turnsCompleted: number;
  totalRounds: number;
  evaluation: SessionEvaluationSummary;
}

interface StubScenario {
  record: ScenarioRecord;
}

interface StubSession {
  callAttemptId: string;
  traineeId: string;
  scenario: StubScenario;
  mode: PracticeMode;
  difficultyLevel: DifficultyLevel;
  currentRound: number;
  status: CallStatus;
  turns: TurnSummary[];
  won: boolean;
  startedAt: string;
}

const sessions = new Map<string, StubSession>();
const historyByTrainee = new Map<string, HistoryEntry[]>();
const customScenarios = new Map<string, StubScenario>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPresetScenario(slug: string): StubScenario | null {
  const client = getClientBySlug(slug);
  if (!client) return null;

  return {
    record: {
      id: `preset-${slug}`,
      slug,
      isPreset: true,
      clientName: client.name,
      clientTitle: client.title,
      companyContext: client.company,
      difficultyLabel: client.difficulty,
      indicator: client.indicator,
      painPoints: client.pains,
      industry: null,
      productSold: null,
      temperament: null,
      clientProblem: null,
      objections: [],
      winCriteria: null,
      config: buildScenarioConfig({
        industry: client.company,
        productSold: client.indicator,
        clientProblem: client.pains[0] ?? "",
        objections: client.pains,
        winCriteria: DEFAULT_WIN_CRITERIA,
        temperament: client.difficulty,
        clientName: client.name,
      }),
    },
  };
}

function getScenario(slug: string): StubScenario | null {
  return customScenarios.get(slug) ?? buildPresetScenario(slug);
}

export function stubListScenarios(): ScenarioRecord[] {
  const presets = ["mariana", "rodrigo", "efrain"]
    .map((slug) => buildPresetScenario(slug)?.record)
    .filter((s): s is ScenarioRecord => s !== undefined);
  return [...presets, ...Array.from(customScenarios.values()).map((s) => s.record)];
}

export function stubCreateScenario(
  input: CreateCustomScenarioInput,
): ScenarioRecord {
  const config = buildScenarioConfig({
    industry: input.industry,
    productSold: input.productSold,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    temperament: input.temperament,
    clientName: input.clientName,
  });

  const slug = `${input.clientName}-${input.industry}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  const record: ScenarioRecord = {
    id: generateId("scenario"),
    slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
    isPreset: false,
    clientName: input.clientName,
    clientTitle: input.clientTitle,
    companyContext: input.companyContext,
    difficultyLabel: input.difficultyLabel,
    indicator: input.winCriteria.slice(0, 80),
    painPoints: [input.clientProblem, ...input.objections],
    industry: input.industry,
    productSold: input.productSold,
    temperament: input.temperament,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    config,
  };

  customScenarios.set(record.slug, { record });
  return record;
}

export function stubCreateSession(body: CreateSessionRequest): SessionResponse {
  const scenario = getScenario(body.scenarioSlug);
  if (!scenario) {
    throw new Error(`Cliente no encontrado: ${body.scenarioSlug}`);
  }

  const callAttemptId = generateId("stub");
  const totalRounds = CLINIC_PHASE_COUNT;

  const session: StubSession = {
    callAttemptId,
    traineeId: body.traineeId ?? generateId("trainee"),
    scenario,
    mode: body.mode,
    difficultyLevel: body.difficultyLevel,
    currentRound: 1,
    status: "in_progress",
    turns: [],
    won: false,
    startedAt: new Date().toISOString(),
  };
  sessions.set(callAttemptId, session);

  return {
    callAttemptId,
    traineeId: session.traineeId,
    scenarioSlug: body.scenarioSlug,
    clientName: scenario.record.clientName,
    isPreset: scenario.record.isPreset,
    mode: body.mode,
    difficultyLevel: body.difficultyLevel,
    status: "in_progress",
    currentRound: 1,
    totalRounds,
  };
}

/** True when the in-memory demo simulator owns this call. */
export function stubHasSession(callAttemptId: string): boolean {
  return sessions.has(callAttemptId);
}

export async function stubSubmitTurn(
  callAttemptId: string,
  body: TurnRequest,
): Promise<TurnResponse> {
  const session = sessions.get(callAttemptId);
  if (!session) throw new Error("Sesión no encontrada");
  if (session.status !== "in_progress") throw new Error("La sesión ya terminó");

  const phaseCount = CLINIC_PHASE_COUNT;

  if (session.currentRound > SESSION_MAX_TURN_ALLOCATIONS) {
    throw new Error("All rounds already completed");
  }

  const roundNumber = session.currentRound;
  const trimmed = body.utterance.trim();
  if (!trimmed) throw new Error("Utterance cannot be empty");

  let roundKey: string;
  let roundLabel: string;
  let roundType: RoundType;
  let roundGoal = "";

  if (session.scenario.record.isPreset) {
    const presetRound = getRoundTypeForNumber(roundNumber);
    if (!presetRound) throw new Error("Invalid round");
    roundType = presetRound;
    roundKey = resolveRoundKey(roundType, roundNumber);
    const labels: Record<string, string> = {
      apertura: "Apertura",
      objecion: "Objeción",
      claridad: "Claridad",
      correo: "Correo",
      cierre: "Cierre",
    };
    roundLabel = labels[roundType];
  } else {
    const rounds = session.scenario.record.config.rounds;
    const phaseIndex = Math.min(roundNumber - 1, rounds.length - 1);
    const round = rounds[phaseIndex];
    roundKey = resolveRoundKey(round.key, roundNumber, rounds.length);
    roundLabel = round.label;
    roundGoal = round.goal;
    const customRound = getRoundTypeForNumber(roundNumber);
    if (!customRound) throw new Error("Invalid round");
    roundType = customRound;
  }

  const priorLines = session.turns.flatMap((turn) => {
    const lines = [{ role: "trainee" as const, text: turn.utterance }];
    return lines;
  });

  const score = await scoreTurnAdaptive({
    utterance: trimmed,
    roundKey,
    roundLabel,
    roundGoal,
    difficultyLevel: session.difficultyLevel,
    scenarioSlug: session.scenario.record.slug,
    isPreset: session.scenario.record.isPreset,
    config: session.scenario.record.isPreset ? null : session.scenario.record.config,
    clientName: session.scenario.record.clientName,
    isLastRound: roundNumber === phaseCount,
    priorLines,
  });

  const summary: TurnSummary = {
    roundKey,
    roundLabel,
    roundType,
    utterance: trimmed,
    expectedPhrase: score.richFeedback.strongerLine,
    roundScore: score.roundScore,
    richFeedback: score.richFeedback,
  };

  session.turns.push(summary);
  session.currentRound = roundNumber + 1;
  if (score.won) session.won = true;

  return {
    turnId: generateId("turn"),
    roundNumber,
    roundType,
    roundKey,
    roundLabel,
    traineeUtterance: trimmed,
    roundScore: score.roundScore,
    keywordHits: {},
    clientReaction: score.clientReaction,
    clientReply: score.clientReply,
    feedback: score.feedback,
    richFeedback: score.richFeedback,
    hasConcreteDayAndTime: score.hasConcreteDayAndTime,
    won: score.won,
  };
}

export async function stubEndSession(callAttemptId: string): Promise<EndSessionResponse> {
  const session = sessions.get(callAttemptId);
  if (!session) throw new Error("Sesión no encontrada");

  session.status = "completed";

  const totalRounds = CLINIC_PHASE_COUNT;

  const closeRoundKey = session.scenario.record.isPreset
    ? "cierre"
    : (session.scenario.record.config.rounds[
        session.scenario.record.config.rounds.length - 1
      ]?.key ?? "cierre");

  const transcriptLines = buildTranscriptFromTurns(
    session.turns.map((turn) => ({ utterance: turn.utterance })),
  );

  const sessionScore = await scoreCall({
    lines: transcriptLines,
    config: session.scenario.record.isPreset ? null : session.scenario.record.config,
    isPreset: session.scenario.record.isPreset,
  });

  session.won = resolveEndSessionWin(
    {
      isPreset: session.scenario.record.isPreset,
      closeRoundKey,
      config: session.scenario.record.isPreset ? null : session.scenario.record.config,
    },
    session.turns.map((turn) => ({
      roundType: turn.roundType,
      roundKey: turn.roundKey,
      traineeUtterance: turn.utterance,
    })),
  );

  const totalScore = sessionScore.scorecard.overallScore;

  const evaluation = buildSessionEvaluation(
    session.turns.map((t) => ({
      roundKey: t.roundKey,
      roundLabel: t.roundLabel,
      roundScore: t.roundScore,
      richFeedback: t.richFeedback,
    })),
    session.won,
    session.scenario.record.isPreset ? null : session.scenario.record.config,
    [],
    sessionScore,
  );

  const endedAt = new Date().toISOString();
  const entry: HistoryEntry = {
    callAttemptId,
    traineeId: session.traineeId,
    scenarioSlug: session.scenario.record.slug,
    clientName: session.scenario.record.clientName,
    difficultyLevel: session.difficultyLevel,
    mode: session.mode,
    status: "completed",
    won: session.won,
    totalScore,
    startedAt: session.startedAt,
    endedAt,
    turnsCompleted: session.turns.length,
  };

  const existing = historyByTrainee.get(session.traineeId) ?? [];
  historyByTrainee.set(session.traineeId, [entry, ...existing].slice(0, 50));

  return {
    callAttemptId,
    status: "completed",
    won: session.won,
    totalScore,
    turnsCompleted: session.turns.length,
    totalRounds,
    evaluation,
  };
}

export function stubListHistory(traineeId: string): HistoryEntry[] {
  return [...(historyByTrainee.get(traineeId) ?? [])];
}

export function stubGetOpeningLine(scenarioSlug: string): string {
  const scenario = getScenario(scenarioSlug);
  if (!scenario) return "¿Quién habla?";
  if (scenario.record.isPreset) {
    const client = getClientBySlug(scenarioSlug);
    return client?.openings[0] ?? "¿Quién habla?";
  }
  return getOpeningLine(scenario.record.config);
}

export function stubGetTurnSummaries(callAttemptId: string): TurnSummary[] {
  return [...(sessions.get(callAttemptId)?.turns ?? [])];
}

export function resetStubSessions(): void {
  sessions.clear();
  historyByTrainee.clear();
  customScenarios.clear();
}
