import type { DifficultyLevel } from "@/lib/db/types";
import type { ScenarioRoundDef } from "@/lib/scenarios/types";
import {
  DEFAULT_MOODS,
  RECEIVER_INDUSTRIES,
  RECEIVER_ROLES,
} from "./constants";
import { SeededRng, buildSessionSeed } from "./seed";
import type {
  AttentionState,
  DialogueTypeConfig,
  GeneratedKrakenScenario,
  KrakenLabCohortConfig,
  KrakenLabScenarioConfig,
  KrakenLabScenarioMeta,
  ReceiverGender,
  ReceiverPersona,
  SimulationFocus,
} from "./types";

const FEMALE_NAMES = [
  "Mariana",
  "Lucía",
  "Valentina",
  "Camila",
  "Daniela",
  "Sofía",
  "Andrea",
  "Paola",
];

const MALE_NAMES = [
  "Rodrigo",
  "Carlos",
  "Eduardo",
  "Fernando",
  "Héctor",
  "Javier",
  "Miguel",
  "Raúl",
];

const LAST_NAMES = [
  "Escobedo",
  "Nava",
  "Loera",
  "Mendoza",
  "Vargas",
  "Herrera",
  "Castillo",
  "Ríos",
];

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

function attentionPrompt(
  state: AttentionState,
  persona: ReceiverPersona,
  difficulty: DifficultyLevel,
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

  return prompts[state].trim();
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
    "sessionSeed" | "participants" | "dialogueTypes" | "difficultyLevel"
  >,
  count = 1,
): ReceiverPersona[] {
  const rng = new SeededRng(`${cohort.sessionSeed}:personas`);
  const cities =
    cohort.participants.flatMap((p) => p.simulationCities).filter(Boolean) ||
    cohort.participants.map((p) => p.city);

  const personas: ReceiverPersona[] = [];

  for (let i = 0; i < count; i += 1) {
    const gender: ReceiverGender = rng.pick(["masculino", "femenino", "otro"]);
    const firstName =
      gender === "femenino"
        ? rng.pick(FEMALE_NAMES)
        : gender === "masculino"
          ? rng.pick(MALE_NAMES)
          : rng.pick([...FEMALE_NAMES, ...MALE_NAMES]);
    const lastName = rng.pick(LAST_NAMES);
    const industry = rng.pick(RECEIVER_INDUSTRIES);
    const role = rng.pick(RECEIVER_ROLES);
    const city = rng.pick(cities.length > 0 ? cities : ["Ciudad de México"]);
    const homeStress = rng.int(
      0,
      cohort.difficultyLevel === 3 ? 8 : cohort.difficultyLevel === 2 ? 6 : 4,
    );
    const workStress = rng.int(
      cohort.difficultyLevel,
      cohort.difficultyLevel === 3 ? 10 : cohort.difficultyLevel === 2 ? 8 : 6,
    );
    const moods = rng.pickMany(DEFAULT_MOODS, rng.int(2, 3));
    const attentionStates = ATTENTION_BY_DIFFICULTY[cohort.difficultyLevel];

    personas.push({
      id: `persona-${i + 1}-${rng.int(1000, 9999)}`,
      name: `${firstName} ${lastName}`,
      age: rng.int(32, 58),
      gender,
      role,
      company: `${industry} ${city.split(" ")[0]}`,
      city,
      moods,
      homeStress,
      workStress,
      attentionStates,
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
  const objections = OBJECTION_TEMPLATES[cohort.difficultyLevel];
  const rng = new SeededRng(`${cohort.sessionSeed}:battery:${persona.id}`);

  return keys.map((key, index) => {
    const attention =
      persona.attentionStates[index] ??
      ATTENTION_BY_DIFFICULTY[cohort.difficultyLevel][index];
    const basePrompt = attentionPrompt(attention, persona, cohort.difficultyLevel);
    const product = primaryDialogue.productServiceExplanation.trim();
    const context = primaryDialogue.simulationContext.trim();

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

export function buildKrakenScenario(
  cohort: KrakenLabCohortConfig,
  personaIndex = 0,
): GeneratedKrakenScenario {
  const persona =
    cohort.receiverPersonas[personaIndex] ?? cohort.receiverPersonas[0];
  if (!persona) {
    throw new Error("Se requiere al menos una persona receptora");
  }

  const primaryDialogue = cohort.dialogueTypes[0];
  const focus = primaryDialogue?.focus ?? "ventas";
  const rounds = buildDialogueBattery(cohort, persona);
  const rng = new SeededRng(`${cohort.sessionSeed}:scenario:${persona.id}`);

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

  const product = primaryDialogue?.productServiceExplanation.trim() ?? "servicio";
  const problem =
    primaryDialogue?.simulationContext.trim() ||
    primaryDialogue?.realObjective.trim() ||
    "operaciones diarias";

  const config: KrakenLabScenarioConfig = {
    industry: persona.extras.industry,
    productSold: product,
    clientProblem: problem,
    objections: OBJECTION_TEMPLATES[cohort.difficultyLevel],
    winCriteria: winCriteriaForFocus(focus, cohort.roleObjective),
    temperament: `${persona.moods.join(", ")}; estrés trabajo ${persona.workStress}/10`,
    rounds,
    criteria: [],
    globalPositiveCriteria: ["problema", "reconocimiento", "reunion", "dia_hora"],
    openingLines: [
      `¿Quién habla? Soy ${persona.name}, ${persona.role}. Estoy ${persona.moods[0] ?? "ocupado"}.`,
      `Si es otra llamada de ${product.slice(0, 40)}, tengo poco tiempo.`,
    ],
    language: "es",
    callType: focus === "ventas" ? "fria" : "discovery",
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
    difficultyLabel:
      cohort.difficultyLevel === 3
        ? "Difícil"
        : cohort.difficultyLevel === 2
          ? "Exigente"
          : "Accesible",
    indicator: focusLabel(focus, primaryDialogue?.focusOther),
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
  if (cohort.receiverPersonas.length > 0) return cohort;
  return {
    ...cohort,
    receiverPersonas: generateReceiverPersonas(cohort, 1),
  };
}
