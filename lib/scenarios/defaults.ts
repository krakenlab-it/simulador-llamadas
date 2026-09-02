import type {
  DimensionGuides,
  ScenarioCallType,
  ScenarioConfig,
  ScenarioLanguage,
  ScenarioRoundDef,
  ScoringCriterionDef,
} from "./types";

const DEFAULT_ROUND_TEMPLATES: Omit<ScenarioRoundDef, "clientPrompt">[] = [
  {
    key: "apertura",
    label: "Apertura",
    goal: "Presentarse, reconocer el contexto del cliente y enganchar con su problema real.",
    positiveCriteria: ["reconocimiento", "problema", "presentacion"],
    negativeCriteria: ["monologo", "telegrama"],
  },
  {
    key: "objecion",
    label: "Objeción",
    goal: "Validar la objeción sin descalificar y responder con lenguaje del sector.",
    positiveCriteria: ["reconocimiento", "jerga", "problema"],
    negativeCriteria: ["descalifica", "monologo", "telegrama"],
  },
  {
    key: "claridad",
    label: "Claridad",
    goal: "Nombrar el problema concreto y cómo lo medirían juntos.",
    positiveCriteria: ["problema", "medicion"],
    negativeCriteria: ["monologo", "telegrama", "descalifica"],
  },
  {
    key: "correo",
    label: "Correo",
    goal: "Pedir permiso para enviar algo breve; no prometer gratis sin contexto.",
    positiveCriteria: ["reunion", "permiso"],
    negativeCriteria: ["gratis", "monologo", "telegrama"],
  },
  {
    key: "cierre",
    label: "Cierre",
    goal: "Proponer reunión o siguiente paso con día Y hora concretos.",
    positiveCriteria: ["reunion", "dia_hora"],
    negativeCriteria: ["monologo", "telegrama", "descalifica"],
  },
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildIndustryCriteria(
  industry: string,
  productSold: string,
  objections: string[],
): ScoringCriterionDef[] {
  const industryWords = industry
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  const productWords = productSold
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);

  const criteria: ScoringCriterionDef[] = [
    { id: "problema", label: "problema", pattern: "problema|reto|dolor|necesidad" },
    { id: "medicion", label: "medición", pattern: "medici[oó]n|medir|m[eé]trica|resultado" },
    { id: "reconocimiento", label: "reconoce", pattern: "entiendo|comprendo|tiene raz[oó]n|veo que" },
    { id: "reunion", label: "reunión", pattern: "reuni[oó]n|cita|agendar|siguiente paso" },
    { id: "dia_hora", label: "día/hora", pattern: "(lunes|martes|mi[eé]rcoles|jueves|viernes).*(\\d{1,2})" },
    { id: "descalifica", label: "descalifica", pattern: "no es para usted|no califica|no le sirve" },
    { id: "gratis", label: "gratis", pattern: "gratis|sin costo|regalo" },
    { id: "monologo", label: "monólogo", pattern: ".{220,}" },
    { id: "telegrama", label: "telegrama", pattern: "^.{0,18}$" },
    { id: "presentacion", label: "presentación", pattern: "^(hola[,.\s]*)?(soy|me llamo|mi nombre es)\\b" },
    { id: "permiso", label: "permiso", pattern: "permiso|autoriza|le parece si" },
  ];

  if (industryWords.length > 0) {
    criteria.push({
      id: "jerga",
      label: "jerga del sector",
      pattern: industryWords.map(escapeRegex).join("|"),
    });
  }

  if (productWords.length > 0) {
    criteria.push({
      id: "producto",
      label: "producto",
      pattern: productWords.map(escapeRegex).join("|"),
    });
  }

  for (const [index, objection] of objections.slice(0, 2).entries()) {
    const words = objection
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 2);
    if (words.length > 0) {
      criteria.push({
        id: `objecion_${index}`,
        label: `objeción: ${objection.slice(0, 30)}`,
        pattern: words.map(escapeRegex).join("|"),
      });
    }
  }

  return criteria;
}

function buildClientPrompt(
  roundKey: string,
  industry: string,
  clientProblem: string,
  productSold: string,
  temperament: string,
): string {
  const mood =
    temperament.toLowerCase().includes("escépt") ||
    temperament.toLowerCase().includes("escept")
      ? "No me convence todavía."
      : "Tengo poco tiempo.";

  const prompts: Record<string, string> = {
    apertura: `${mood} ¿Qué tiene que ver con ${clientProblem}?`,
    objecion: `Eso ya lo escuché en ${industry}. ¿Qué resultado concreto me trae?`,
    claridad: `Explíqueme en una frase cómo atacarían ${clientProblem}.`,
    correo: `Si manda algo, que sea breve sobre ${productSold}.`,
    cierre: `Sin día y hora concretos no hay siguiente paso.`,
  };

  return prompts[roundKey] ?? `${mood} Siga con ${productSold}.`;
}

export function buildDefaultRounds(
  industry: string,
  productSold: string,
  clientProblem: string,
  temperament: string,
): ScenarioRoundDef[] {
  return DEFAULT_ROUND_TEMPLATES.map((round) => ({
    ...round,
    clientPrompt: buildClientPrompt(
      round.key,
      industry,
      clientProblem,
      productSold,
      temperament,
    ),
  }));
}

export function buildScenarioConfig(input: {
  industry: string;
  productSold: string;
  clientProblem: string;
  objections: string[];
  winCriteria: string;
  temperament: string;
  clientName: string;
  rounds?: ScenarioRoundDef[];
  language?: ScenarioLanguage;
  callType?: ScenarioCallType;
  dimensionGuides?: DimensionGuides;
}): ScenarioConfig {
  const rounds =
    input.rounds && input.rounds.length > 0
      ? input.rounds
      : buildDefaultRounds(
          input.industry,
          input.productSold,
          input.clientProblem,
          input.temperament,
        );

  const criteria = buildIndustryCriteria(
    input.industry,
    input.productSold,
    input.objections,
  );

  return {
    industry: input.industry,
    productSold: input.productSold,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    temperament: input.temperament,
    rounds,
    criteria,
    globalPositiveCriteria: criteria
      .filter((c) =>
        ["problema", "medicion", "jerga", "reconocimiento", "reunion", "dia_hora", "producto"].includes(
          c.id,
        ),
      )
      .map((c) => c.id),
    openingLines: [
      `¿Quién habla? Estoy ocupado con ${input.clientProblem}.`,
      `Si es otro discurso de ${input.productSold}, no tengo tiempo.`,
    ],
    language: input.language ?? "es",
    callType: input.callType ?? "discovery",
    dimensionGuides: input.dimensionGuides ?? {},
  };
}

export function slugifyScenario(clientName: string, industry: string): string {
  const base = `${clientName}-${industry}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}
