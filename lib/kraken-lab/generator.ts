import type { DifficultyLevel } from "@/lib/db/types";
import { buildAgenticScenarioContextText } from "@/lib/agentic/scenario-context-text";
import { pickTone } from "@/lib/agentic/tone-bank";
import type { ScenarioRoundDef } from "@/lib/scenarios/types";
import { DEFAULT_MOODS } from "./constants";
import {
  buildDialogueCorpus,
  deriveCompanyLabel,
  deriveIndustryFromCorpus,
  deriveObjectionsForDifficulty,
  derivePainPointsFromCorpus,
  deriveProblemFromDialogue,
  deriveProductFromDialogue,
  deriveRoleFromCorpus,
  extractObjectionsFromCorpus,
  hasRichScenarioContext,
} from "./context-anchors";
import {
  DIFFICULTY_LABELS,
  FEMALE_FIRST_NAMES,
  isBlockedPersonaName,
  KPI_TEMPLATES,
  LAST_NAMES,
  MALE_FIRST_NAMES,
  PAIN_TEMPLATES,
  RECEIVER_INDUSTRIES,
  RECEIVER_ROLES,
  TEMPERAMENT_BY_DIFFICULTY,
} from "./persona-pools";
import { scenarioContextSnippet, fullScenarioContextText } from "./scenario-context";
import { SeededRng, buildSessionSeed, mintFreshSessionSeed } from "./seed";
import type {
  AttentionState,
  DialogueTypeConfig,
  GeneratedKrakenScenario,
  KrakenLabCohortConfig,
  KrakenLabScenarioConfig,
  KrakenLabScenarioMeta,
  ReceiverGender,
  ReceiverPersona,
  ScenarioContextUpload,
  SimulationFocus,
} from "./types";

const ATTENTION_BY_DIFFICULTY: Record<DifficultyLevel, AttentionState[]> = {
  1: ["escuchando", "interesado", "ocupado", "escuchando", "interesado"],
  2: ["ocupado", "esceptico", "ya_tiene_proveedor", "escuchando", "impaciente"],
  3: ["gatekeeper", "impaciente", "ya_tiene_proveedor", "esceptico", "ocupado"],
};

const OBJECTION_TEMPLATES: Record<DifficultyLevel, string[]> = {
  1: [
    "No estoy seguro de que aplique a nuestro caso.",
    "Mándeme información y lo reviso con calma.",
  ],
  2: [
    "Ya tenemos un proveedor para eso.",
    "No tengo presupuesto este trimestre.",
    "Suena bien pero necesito ver resultados concretos.",
  ],
  3: [
    "No me interesa, ya tenemos solución.",
    "Mande correo, no tengo tiempo ahora.",
    "¿Cómo consiguió mi número? No recibo llamadas frías.",
    "Mi jefe decide eso, yo no.",
  ],
};

const PERSONA_COUNT = 3;

function focusLabel(focus: SimulationFocus | "otro", other?: string): string {
  if (focus === "otro") return other?.trim() || "Práctica personalizada";
  switch (focus) {
    case "ventas":
      return "Ventas";
    case "speech-rapido":
      return "Speech rápido";
    case "seguimiento":
      return "Seguimiento";
    case "motivacion-personal":
      return "Motivación personal";
    default:
      return focus;
  }
}

function winCriteriaForFocus(
  focus: SimulationFocus | "otro",
  roleObjective: string,
): string {
  const objective = roleObjective.trim();
  if (objective.length > 0) return objective;

  switch (focus) {
    case "ventas":
      return "Cierre con día y hora concretos para la siguiente reunión";
    case "speech-rapido":
      return "Mensaje claro en menos de 30 segundos con siguiente paso concreto";
    case "seguimiento":
      return "Confirmar avance del acuerdo previo y fijar fecha de seguimiento";
    case "motivacion-personal":
      return "Conectar con el motivo personal del interlocutor y acordar un compromiso";
    default:
      return "Siguiente paso concreto acordado con el interlocutor";
  }
}

function roundLabelsForFocus(focus: SimulationFocus | "otro"): string[] {
  switch (focus) {
    case "speech-rapido":
      return ["Gancho", "Valor", "Objeción", "Prueba", "Cierre rápido"];
    case "seguimiento":
      return ["Reconexión", "Estado", "Objeción", "Acuerdo", "Próximo paso"];
    case "motivacion-personal":
      return ["Rapport", "Motivo", "Objeción", "Compromiso", "Cierre"];
    case "ventas":
    default:
      return ["Apertura", "Objeción", "Claridad", "Correo", "Cierre"];
  }
}

function roundKeys(): string[] {
  return ["apertura", "objecion", "claridad", "correo", "cierre"];
}

function uniqueObjections(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function difficultyLabelForLevel(level: DifficultyLevel, rng: SeededRng): string {
  if (level === 1) return rng.pick(["Baja", "Accesible", "Media"]);
  if (level === 3) return rng.pick(["Difícil", "Muy difícil", "Intermedia-alta"]);
  return rng.pick(DIFFICULTY_LABELS);
}

function contextKeywords(context: ScenarioContextUpload | undefined): string[] {
  return fullScenarioContextText(context)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4)
    .slice(0, 10);
}

function buildPainPoints(
  rng: SeededRng,
  context: ScenarioContextUpload | undefined,
  count: number,
): string[] {
  const used = new Set<string>();
  const pains: string[] = [];
  const keywords = contextKeywords(context);

  while (pains.length < count) {
    let candidate: string;
    if (keywords.length > 0 && rng.int(0, 1) === 1) {
      const keyword = rng.pick(keywords);
      candidate = `Reto operativo ligado a ${keyword}`;
    } else {
      candidate = rng.pick(PAIN_TEMPLATES);
    }
    if (!used.has(candidate)) {
      used.add(candidate);
      pains.push(candidate);
    }
  }

  return pains;
}

function normalizeHint(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function industryKpiHints(industry: string): string[] {
  const normalized = normalizeHint(industry);
  if (normalized.includes("retail")) {
    return ["conversion", "inventario", "retencion", "sucursal"];
  }
  if (normalized.includes("logist")) {
    return ["entregas", "logistico", "envio"];
  }
  if (normalized.includes("telecom")) {
    return ["respuesta", "retencion", "clientes"];
  }
  if (normalized.includes("servicios")) {
    return ["lead", "productividad", "cobranza"];
  }
  if (normalized.includes("manufact") || normalized.includes("automot")) {
    return ["productividad", "retrabajo", "entregas"];
  }
  if (normalized.includes("import") || normalized.includes("distrib")) {
    return ["inventario", "entregas", "pedido"];
  }
  if (normalized.includes("salud") || normalized.includes("hospital")) {
    return ["turno", "respuesta", "retencion"];
  }
  return [];
}

function scoreKpiTemplate(template: string, hints: string[]): number {
  const normalizedTemplate = normalizeHint(template);
  return hints.reduce(
    (score, hint) => (normalizedTemplate.includes(hint) ? score + 1 : score),
    0,
  );
}

function buildIndicator(
  rng: SeededRng,
  context: ScenarioContextUpload | undefined,
  industry: string,
  usedIndicators: Set<string>,
): string {
  const hints = [
    ...contextKeywords(context).map(normalizeHint),
    ...industryKpiHints(industry),
  ].filter((hint) => hint.length >= 4);

  const ranked = KPI_TEMPLATES.map((template) => ({
    template,
    score: scoreKpiTemplate(template, hints),
  }));
  const bestScore = Math.max(...ranked.map((entry) => entry.score));
  const pool =
    bestScore > 0
      ? ranked.filter((entry) => entry.score === bestScore).map((entry) => entry.template)
      : [...KPI_TEMPLATES];

  const unusedInPool = pool.filter((template) => !usedIndicators.has(template));
  let pickPool =
    unusedInPool.length > 0
      ? unusedInPool
      : KPI_TEMPLATES.filter((template) => !usedIndicators.has(template));
  if (pickPool.length === 0) {
    pickPool = [...KPI_TEMPLATES];
  }

  const indicator = rng.pick(pickPool);
  usedIndicators.add(indicator);
  return indicator;
}

function deriveAttentionBattery(
  persona: Pick<ReceiverPersona, "temperament" | "moods">,
  difficulty: DifficultyLevel,
  rng: SeededRng,
): AttentionState[] {
  const base = [...ATTENTION_BY_DIFFICULTY[difficulty]];
  const temperament = persona.temperament.toLowerCase();

  if (temperament.includes("gatekeeper")) base[0] = "gatekeeper";
  if (temperament.includes("impaciente")) base[1] = "impaciente";
  if (temperament.includes("escéptico") || temperament.includes("esceptico")) {
    base[2] = "esceptico";
  }
  if (persona.moods.some((mood) => mood.includes("ocupado"))) base[3] = "ocupado";

  return rng.shuffle(base);
}

function pickUniqueName(
  rng: SeededRng,
  gender: ReceiverGender,
  usedNames: Set<string>,
): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const firstName =
      gender === "femenino"
        ? rng.pick(FEMALE_FIRST_NAMES)
        : gender === "masculino"
          ? rng.pick(MALE_FIRST_NAMES)
          : rng.pick([...FEMALE_FIRST_NAMES, ...MALE_FIRST_NAMES]);
    const lastName = rng.pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    if (!isBlockedPersonaName(fullName) && !usedNames.has(fullName.toLowerCase())) {
      usedNames.add(fullName.toLowerCase());
      return fullName;
    }
  }

  return `Persona ${rng.int(100, 999)}`;
}

function attentionPrompt(
  state: AttentionState,
  persona: ReceiverPersona,
  difficulty: DifficultyLevel,
  contextSnippet: string,
): string {
  const stress =
    persona.workStress >= 7
      ? "Estoy bajo mucha presión en el trabajo."
      : persona.homeStress >= 7
        ? "Tengo asuntos personales complicados."
        : "";

  const prompts: Record<AttentionState, string> = {
    ocupado: `${stress} Estoy ocupado. Sea breve.`,
    ya_tiene_proveedor: `Ya tenemos proveedor para esto. ${stress}`,
    escuchando: `Le escucho, pero tengo poco tiempo. ${stress}`,
    esceptico: `Suena a lo de siempre. ¿Qué resultado concreto? ${stress}`,
    gatekeeper: `No soy quien decide. ¿De qué se trata en una frase? ${stress}`,
    interesado: `Ok, cuénteme más — pero vaya al punto. ${stress}`,
    impaciente:
      difficulty >= 3
        ? `Tengo 30 segundos. ¿Por qué debería escucharle? ${stress}`
        : `No tengo mucho tiempo. ${stress}`,
  };

  const base = prompts[state].trim();
  return contextSnippet ? `${contextSnippet}. ${base}` : base;
}

function buildRoundGoal(
  focus: SimulationFocus | "otro",
  roundIndex: number,
  dialogue: DialogueTypeConfig,
): string {
  const labels = roundLabelsForFocus(focus);
  const label = labels[roundIndex] ?? `Ronda ${roundIndex + 1}`;
  const context = dialogue.realObjective.trim() || dialogue.simulationContext.trim();

  switch (focus) {
    case "speech-rapido":
      if (roundIndex === 0) return "Captar atención en una frase clara.";
      if (roundIndex === 4) return "Cerrar con día/hora o paso concreto en menos de 20 segundos.";
      break;
    case "seguimiento":
      if (roundIndex === 0) return "Reconectar con el acuerdo anterior sin repetir todo.";
      if (roundIndex === 4) return "Fijar fecha concreta de seguimiento.";
      break;
    case "motivacion-personal":
      if (roundIndex === 1) return "Explorar el motivo personal detrás de la decisión.";
      if (roundIndex === 3) return "Obtener un compromiso verbal concreto.";
      break;
    case "ventas":
    default:
      if (roundIndex === 4) return "Proponer reunión con día Y hora concretos.";
      break;
  }

  return `${label}: avanzar hacia «${context.slice(0, 80)}».`;
}

export function generateReceiverPersonas(
  cohort: Pick<
    KrakenLabCohortConfig,
    | "sessionSeed"
    | "participants"
    | "dialogueTypes"
    | "difficultyLevel"
    | "scenarioContext"
    | "project"
    | "roleObjective"
  >,
  count = PERSONA_COUNT,
): ReceiverPersona[] {
  const rng = new SeededRng(`${cohort.sessionSeed}:personas`);
  const cities =
    cohort.participants.flatMap((participant) => participant.simulationCities).filter(Boolean) ||
    cohort.participants.map((participant) => participant.city);
  const corpus = buildDialogueCorpus(cohort);
  const anchored = hasRichScenarioContext(corpus);

  const personas: ReceiverPersona[] = [];
  const usedNames = new Set<string>();
  const usedIndicators = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const gender: ReceiverGender = rng.pick(["masculino", "femenino", "otro"]);
    const name = pickUniqueName(rng, gender, usedNames);
    const industry = anchored
      ? deriveIndustryFromCorpus(corpus, rng)
      : rng.pick(RECEIVER_INDUSTRIES);
    const role = anchored ? deriveRoleFromCorpus(corpus, rng) : rng.pick(RECEIVER_ROLES);
    const city = rng.pick(cities.length > 0 ? cities : ["Ciudad de México", "Monterrey", "Guadalajara"]);
    const homeStress = rng.int(
      0,
      cohort.difficultyLevel === 3 ? 8 : cohort.difficultyLevel === 2 ? 6 : 4,
    );
    const workStress = rng.int(
      cohort.difficultyLevel,
      cohort.difficultyLevel === 3 ? 10 : cohort.difficultyLevel === 2 ? 8 : 6,
    );
    const moods = rng.pickMany(DEFAULT_MOODS, rng.int(2, 3));
    const temperament = rng.pick(TEMPERAMENT_BY_DIFFICULTY[cohort.difficultyLevel]);
    const difficultyLabel = difficultyLabelForLevel(cohort.difficultyLevel, rng);
    const painPoints = anchored
      ? derivePainPointsFromCorpus(corpus, rng, rng.int(1, 3))
      : buildPainPoints(rng, cohort.scenarioContext, rng.int(1, 3));
    const indicator = buildIndicator(rng, cohort.scenarioContext, industry, usedIndicators);
    const attentionStates = deriveAttentionBattery(
      { temperament, moods },
      cohort.difficultyLevel,
      rng,
    );
    const company = anchored
      ? deriveCompanyLabel(corpus, industry, city)
      : `${industry} ${city.split(" ")[0]}`;

    personas.push({
      id: `persona-${index + 1}-${rng.int(1000, 9999)}`,
      name,
      age: rng.int(32, 58),
      gender,
      role,
      company,
      city,
      moods,
      homeStress,
      workStress,
      attentionStates,
      difficultyLabel,
      indicator,
      painPoints,
      temperament,
      extras: {
        industry,
        objectionStyle:
          cohort.difficultyLevel === 3
            ? "Cortante, poco tiempo"
            : cohort.difficultyLevel === 2
              ? "Escéptico pero razonable"
              : "Abierto con reservas",
        patienceLevel:
          cohort.difficultyLevel === 3
            ? "Muy baja"
            : cohort.difficultyLevel === 2
              ? "Media"
              : "Alta",
      },
    });
  }

  return personas;
}

export function buildDialogueBattery(
  cohort: KrakenLabCohortConfig,
  persona: ReceiverPersona,
): ScenarioRoundDef[] {
  const primaryDialogue = cohort.dialogueTypes[0];
  if (!primaryDialogue) {
    throw new Error("Se requiere al menos un tipo de diálogo");
  }

  const focus = primaryDialogue.focus;
  const labels = roundLabelsForFocus(focus);
  const keys = roundKeys();
  const rng = new SeededRng(`${cohort.sessionSeed}:battery:${persona.id}`);
  const corpus = buildDialogueCorpus(cohort);
  const anchored = hasRichScenarioContext(corpus);
  const objections = anchored
    ? deriveObjectionsForDifficulty(
        corpus,
        cohort.difficultyLevel,
        OBJECTION_TEMPLATES,
        rng,
      )
    : OBJECTION_TEMPLATES[cohort.difficultyLevel];
  const contextSnippet = scenarioContextSnippet(cohort.scenarioContext, 100);

  return keys.map((key, index) => {
    const attention =
      persona.attentionStates[index] ??
      ATTENTION_BY_DIFFICULTY[cohort.difficultyLevel][index];
    const basePrompt = attentionPrompt(
      attention,
      persona,
      cohort.difficultyLevel,
      contextSnippet,
    );
    const product =
      primaryDialogue.productServiceExplanation.trim() ||
      scenarioContextSnippet(cohort.scenarioContext, 80);
    const context = primaryDialogue.simulationContext.trim() || contextSnippet;

    let clientPrompt = basePrompt;
    if (index === 1) {
      clientPrompt = `${rng.pick(objections)} ${basePrompt}`;
    } else if (index === 2 && product) {
      clientPrompt = `Sobre ${product.slice(0, 60)}… ${basePrompt}`;
    } else if (index === 0 && context) {
      clientPrompt = `${context.slice(0, 80)}. ${basePrompt}`;
    }

    return {
      key,
      label: labels[index] ?? labels[0],
      goal: buildRoundGoal(focus, index, primaryDialogue),
      clientPrompt,
      positiveCriteria: [
        "reconocimiento",
        "problema",
        ...(index === 4 ? (["dia_hora", "reunion"] as const) : []),
        ...(focus === "speech-rapido" ? (["presentacion"] as const) : []),
      ],
      negativeCriteria: ["monologo", "telegrama", "descalifica"],
      whatGoodLooksLike:
        index === 4
          ? winCriteriaForFocus(focus, cohort.roleObjective)
          : buildRoundGoal(focus, index, primaryDialogue),
    };
  });
}

function resolveSelectedPersona(cohort: KrakenLabCohortConfig): ReceiverPersona {
  const selected =
    cohort.receiverPersonas.find((persona) => persona.id === cohort.selectedPersonaId) ??
    cohort.receiverPersonas[0];
  if (!selected) {
    throw new Error("Se requiere al menos una persona receptora");
  }
  return selected;
}

export function buildKrakenScenario(
  cohort: KrakenLabCohortConfig,
  personaIndex?: number,
): GeneratedKrakenScenario {
  const persona =
    personaIndex !== undefined
      ? cohort.receiverPersonas[personaIndex]
      : resolveSelectedPersona(cohort);
  if (!persona) {
    throw new Error("Se requiere al menos una persona receptora");
  }

  const primaryDialogue = cohort.dialogueTypes[0];
  const focus = primaryDialogue?.focus ?? "ventas";
  const rounds = buildDialogueBattery(cohort, persona);
  const rng = new SeededRng(`${cohort.sessionSeed}:scenario:${persona.id}`);
  const corpus = buildDialogueCorpus(cohort);
  const anchored = hasRichScenarioContext(corpus);
  const contextSnippet = scenarioContextSnippet(cohort.scenarioContext, 120);

  const meta: KrakenLabScenarioMeta = {
    cohortId: cohort.id ?? "local",
    sessionSeed: cohort.sessionSeed,
    project: cohort.project,
    simulatorRole: cohort.simulatorRole,
    roleObjective: cohort.roleObjective,
    simulationFocuses: cohort.simulationFocuses,
    selectedPersonaId: persona.id,
    attentionBattery: persona.attentionStates,
    difficultyLevel: cohort.difficultyLevel,
  };

  const product =
    deriveProductFromDialogue(primaryDialogue, corpus) ||
    primaryDialogue?.productServiceExplanation.trim() ||
    contextSnippet ||
    "servicio";
  const problem =
    deriveProblemFromDialogue(primaryDialogue, corpus, persona.painPoints[0]) ||
    primaryDialogue?.simulationContext.trim() ||
    primaryDialogue?.realObjective.trim() ||
    persona.painPoints[0] ||
    contextSnippet ||
    "operaciones diarias";

  const uploadedContext = fullScenarioContextText(cohort.scenarioContext);
  const contextText = buildAgenticScenarioContextText(
    {
      companyContext: persona.company,
      clientProblem: problem,
      productSold: product,
      industry: persona.extras.industry,
      winCriteria: winCriteriaForFocus(focus, cohort.roleObjective),
      temperament: persona.temperament,
      clientTitle: persona.role,
      objections: anchored
        ? deriveObjectionsForDifficulty(
            corpus,
            cohort.difficultyLevel,
            OBJECTION_TEMPLATES,
            rng,
          )
        : [
            ...OBJECTION_TEMPLATES[cohort.difficultyLevel],
            ...persona.painPoints.slice(0, 2),
          ],
      rounds,
    },
    uploadedContext,
  );
  const tone = pickTone(`${cohort.sessionSeed}:persona`, cohort.difficultyLevel);

  const objections = anchored
    ? uniqueObjections([
        ...extractObjectionsFromCorpus(corpus),
        ...persona.painPoints.slice(0, 2),
      ])
    : [...OBJECTION_TEMPLATES[cohort.difficultyLevel], ...persona.painPoints.slice(0, 2)];

  const config: KrakenLabScenarioConfig = {
    industry: persona.extras.industry,
    productSold: product,
    clientProblem: problem,
    objections,
    winCriteria: winCriteriaForFocus(focus, cohort.roleObjective),
    temperament: persona.temperament,
    rounds,
    criteria: [],
    globalPositiveCriteria: ["problema", "reconocimiento", "reunion", "dia_hora"],
    openingLines: [
      `¿Quién habla? Soy ${persona.name}, ${persona.role}. ${persona.temperament}.`,
      contextSnippet
        ? `Si es por ${product.slice(0, 40)}, tengo poco tiempo. ${contextSnippet.slice(0, 60)}`
        : `Si es otra llamada de ${product.slice(0, 40)}, tengo poco tiempo.`,
    ],
    language: "es",
    callType: focus === "ventas" ? "fria" : "discovery",
    agentic: {
      enabled: false,
      toneId: tone.id,
      sessionSeed: cohort.sessionSeed,
      scenarioContextText: contextText,
    },
    krakenLab: meta,
  };

  const slugBase = `kraken-${persona.name}-${cohort.sessionSeed}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    slug: `${slugBase}-${rng.int(100, 999)}`,
    clientName: persona.name,
    clientTitle: persona.role,
    companyContext: `${persona.company} · ${persona.city}`,
    difficultyLabel: persona.difficultyLabel,
    indicator: persona.indicator,
    config,
  };
}

export function createDefaultSessionSeed(cohort: Partial<KrakenLabCohortConfig>): string {
  return buildSessionSeed([
    cohort.project ?? "simulador-llamadas",
    String(cohort.participantCount ?? 1),
    cohort.participants?.[0]?.email ?? "",
    new Date().toISOString().slice(0, 10),
  ]);
}

export function enrichCohortWithPersonas(
  cohort: KrakenLabCohortConfig,
): KrakenLabCohortConfig {
  if (cohort.receiverPersonas.length >= PERSONA_COUNT) {
    return cohort;
  }
  const personas = generateReceiverPersonas(cohort, PERSONA_COUNT);
  return {
    ...cohort,
    receiverPersonas: personas,
    selectedPersonaId: cohort.selectedPersonaId ?? personas[0]?.id,
  };
}

export { mintFreshSessionSeed };
