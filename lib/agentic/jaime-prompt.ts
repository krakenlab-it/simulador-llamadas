import type { DifficultyLevel, PracticeMode } from "@/lib/db/types";
import type { ScenarioConfig } from "@/lib/scenarios/types";
import { JAIME_CLIENT_SYSTEM_PROMPT_TEMPLATE } from "./jaime-client-system-prompt.template";
import type { ConversationTurn, EmotionalMeters, ScenarioPack } from "./types";

const PACK_START = "========================================\nPACK DEL ESCENARIO (editar aquí)\n========================================";
const PACK_END = "========================================\nCÓMO FUNCIONA LA SESIÓN";

export interface JaimePackInput {
  pack: ScenarioPack;
  config: ScenarioConfig;
  clientName: string;
  channel: PracticeMode;
  difficultyLevel: DifficultyLevel;
  maxTurns: number;
  sellerObjective?: string;
  decisionRole?: string;
  surfaceObjections?: string[];
  realObjection?: string;
  grantConditions?: string;
  country?: string;
  registerStyle?: string;
  mindsetToday?: string;
  currentWorkflow?: string;
}

export interface JaimePromptInput extends JaimePackInput {
  recentTurns: ConversationTurn[];
  traineeUtterance: string;
  meters: EmotionalMeters;
  turnNumber: number;
  isCallEnding?: boolean;
}

export function loadJaimePromptTemplate(): string {
  return JAIME_CLIENT_SYSTEM_PROMPT_TEMPLATE;
}

/** Maps app difficulty 1–3 to Jaime scale 1–5. */
export function mapDifficultyToJaime(level: DifficultyLevel): number {
  if (level <= 1) return 2;
  if (level === 2) return 3;
  return 5;
}

function channelLabel(mode: PracticeMode): string {
  return mode === "voz"
    ? "voz (el alumno te habla o escribe como si fuera una llamada telefónica)"
    : "texto (mensajes cortos tipo WhatsApp o LinkedIn)";
}

function resolveCallType(config: ScenarioConfig): string {
  if (config.callType === "fria") return "llamada en frío";
  if (config.callType === "cierre") return "reunión de presentación";
  if (config.callType === "discovery") return "llamada de seguimiento";
  return "llamada en frío";
}

function resolveSellerObjective(config: ScenarioConfig, override?: string): string {
  const krakenObjective = config.krakenLab?.roleObjective?.trim();
  if (override?.trim()) return override.trim();
  if (krakenObjective) return krakenObjective;
  return config.winCriteria;
}

function resolveSurfaceObjections(
  pack: ScenarioPack,
  config: ScenarioConfig,
  override?: string[],
): string {
  const pool = override?.length ? override : pack.objections.length ? pack.objections : config.objections;
  return pool.filter(Boolean).map((line) => `"${line}"`).join("; ") || '"no tengo tiempo ahorita"';
}

function resolveRealObjection(config: ScenarioConfig, override?: string): string {
  if (override?.trim()) return override.trim();
  const deep = config.objections.find((line) =>
    /agencia|experiencia|antes|mala|gasto|riesgo|confianza/i.test(line),
  );
  return deep ?? config.clientProblem;
}

export function buildJaimeScenarioPackBlock(input: JaimePackInput): string {
  const jaimeDifficulty = mapDifficultyToJaime(input.difficultyLevel);
  const allowedFacts = input.pack.facts.filter(Boolean).join("; ") || input.config.clientProblem;
  const forbidden =
    input.pack.forbiddenClaims.filter(Boolean).join("; ") || "cifras inventadas; nombres de competidores";
  const grantConditions =
    input.grantConditions?.trim() ||
    `que el vendedor conecte su propuesta con ${input.config.clientProblem.toLowerCase()}`;

  return [
    `Canal: ${channelLabel(input.channel)}`,
    `Tipo de encuentro: ${resolveCallType(input.config)}`,
    `Objetivo del vendedor: ${resolveSellerObjective(input.config, input.sellerObjective)}`,
    `Nivel de dificultad: ${jaimeDifficulty} (de 1 a 5)`,
    `Máximo de turnos: ${input.maxTurns}`,
    `País: ${input.country ?? "México"}`,
    `Registro: ${input.registerStyle ?? "español mexicano oral, trato de usted, se relaja con confianza"}`,
    "",
    `Nombre del cliente: ${input.clientName}`,
    `Cargo: ${input.pack.clientTitle || "decisor"}`,
    `Rol en la decisión: ${input.decisionRole ?? "decisor"}`,
    `Empresa: ${input.pack.companyContext || input.config.industry}`,
    `Industria: ${input.pack.industry}`,
    `Temperamento: ${input.pack.temperament}`,
    `Cómo trabaja hoy: ${input.currentWorkflow ?? input.config.clientProblem}`,
    `Dolores (no los confiesa de entrada): ${input.config.clientProblem}`,
    `Lo que tiene en la cabeza hoy: ${input.mindsetToday ?? "ocupado con el día a día del negocio"}`,
    `Lo que le están vendiendo: ${input.pack.product}`,
    "",
    `Hechos permitidos: ${allowedFacts}`,
    `Prohibido afirmar: ${forbidden}`,
    `Objeciones de superficie: ${resolveSurfaceObjections(input.pack, input.config, input.surfaceObjections)}`,
    `Objeción real: ${resolveRealObjection(input.config, input.realObjection)}`,
    `Condiciones para conceder el objetivo: ${grantConditions}`,
    `Criterio de éxito: ${input.pack.winCriteria}`,
  ].join("\n");
}

function replacePackBlock(template: string, packBlock: string): string {
  const start = template.indexOf(PACK_START);
  const end = template.indexOf(PACK_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Jaime prompt template is missing PACK DEL ESCENARIO markers");
  }
  const before = template.slice(0, start + PACK_START.length);
  const after = template.slice(end);
  return `${before}\n${packBlock}\n\n${after}`;
}

function formatConversationThread(turns: ConversationTurn[]): string {
  if (!turns.length) {
    return "(El motor ya contestó el teléfono; la primera línea del cliente aparecerá en la conversación. No vuelvas a contestar.)";
  }
  return turns
    .map((turn) => {
      const speaker = turn.role === "trainee" ? "VENDEDOR" : "CLIENTE";
      return `${speaker}: ${turn.text.trim()}`;
    })
    .join("\n");
}

function runtimeInjection(input: JaimePromptInput): string {
  const thread = formatConversationThread(input.recentTurns);
  const utterance = input.traineeUtterance.trim();

  return `
========================================
ESTADO EN VIVO (no lo reveles al alumno)
========================================
Turno actual: ${input.turnNumber} de ${input.maxTurns}
Medidores actuales (0-10, solo para guiar tu reacción): confianza ${input.meters.confianza}, interés ${input.meters.interes}, paciencia ${input.meters.paciencia}
${input.isCallEnding ? "La llamada está por terminar en este turno." : ""}

CONVERSACIÓN COMPLETA HASTA AHORA
${thread}

ÚLTIMO MENSAJE DEL VENDEDOR (responde directamente a esto)
"${utterance || "(el motor ya inició la llamada; responde al vendedor sin volver a contestar el teléfono)"}"
`.trim();
}

export function buildJaimeClientSystemPrompt(input: JaimePromptInput): string {
  const template = loadJaimePromptTemplate();
  const packBlock = buildJaimeScenarioPackBlock(input);
  const withPack = replacePackBlock(template, packBlock);
  return `${withPack}\n\n${runtimeInjection(input)}`;
}

export function buildJaimeEvaluatorSystemPrompt(input: JaimePackInput): string {
  const template = loadJaimePromptTemplate();
  const packBlock = buildJaimeScenarioPackBlock(input);
  const withPack = replacePackBlock(template, packBlock);
  const evaluatorOnly = withPack.split("========================================\nMODO EVALUADOR")[1];
  return `SIMULADOR DE ENTRENAMIENTO DE VENTAS - KRAKEN SIMULACIÓN

PACK DEL ESCENARIO
${packBlock}

MODO EVALUADOR${evaluatorOnly ?? ""}`;
}

export function buildJaimeEvaluatorUserPrompt(
  turns: ConversationTurn[],
  meters: EmotionalMeters,
): string {
  return `Evalúa la llamada completa.

Medidores finales estimados: confianza ${meters.confianza}, interés ${meters.interes}, paciencia ${meters.paciencia}.

Transcripción:
${formatConversationThread(turns)}`;
}
