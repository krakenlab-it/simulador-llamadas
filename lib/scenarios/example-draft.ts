import {
  defaultDimensionGuides,
  defaultScenarioCallType,
  defaultScenarioLanguage,
  emptyAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "./authoring";

export function buildExampleAuthoringDraft(): ScenarioAuthoringDraft {
  const language = defaultScenarioLanguage();
  return {
    ...emptyAuthoringDraft(language),
    industry: "Importación y distribución",
    productSold: "Kraken Flow — plataforma de flujo comercial B2B",
    clientName: "Valeria Soto",
    clientTitle: "Directora de Compras",
    companyContext: "Importadora del Norte · Monterrey",
    temperament: "Escéptica, poco tiempo",
    difficultyLabel: "Intermedia-alta",
    clientProblem:
      "Pedidos urgentes se atascan entre ventas y almacén; pierden entregas por falta de visibilidad del pipeline comercial.",
    objections: [
      "Ya tenemos ERP y no queremos otro sistema",
      "El equipo de ventas no va a capturar otra cosa más",
    ],
    winCriteria:
      "SPIN Advance: mesa de trabajo el jueves a las 10 con compras y operaciones para revisar un piloto de 3 semanas.",
    language,
    callType: defaultScenarioCallType(),
    rounds: [
      {
        key: "apertura",
        label: "Apertura",
        goal: "Presentarse, reconocer la operación de importación y pedir permiso para continuar.",
        clientPrompt:
          "¿Quién habla? Estoy entre proveedores y un contenedor que entra hoy.",
        positiveCriteria: ["reconocimiento", "problema", "presentacion"],
        negativeCriteria: ["monologo", "telegrama"],
        whatGoodLooksLike:
          "Saludo breve, menciona importación/distribución y pide 2 minutos sin pitch genérico.",
      },
      {
        key: "objecion",
        label: "Objeción",
        goal: "Validar la objeción del ERP sin pelear y reconectar con el cuello de botella real.",
        clientPrompt:
          "Ya pagamos ERP y no vamos a duplicar captura. ¿Qué cambia con Kraken Flow?",
        positiveCriteria: ["reconocimiento", "jerga", "problema"],
        negativeCriteria: ["descalifica", "monologo"],
        whatGoodLooksLike:
          "Reconoce el ERP, habla de visibilidad entre ventas-almacén, no promete reemplazar todo.",
      },
      {
        key: "claridad",
        label: "Claridad",
        goal: "Nombrar el costo de pedidos urgentes atascados y cómo lo medirían.",
        clientPrompt:
          "¿Qué resultado concreto veríamos en importación si esto funciona?",
        positiveCriteria: ["problema", "medicion"],
        negativeCriteria: ["monologo", "telegrama"],
        whatGoodLooksLike:
          "Usa lenguaje de entregas, pedidos urgentes y una métrica operativa clara.",
      },
      {
        key: "correo",
        label: "Correo",
        goal: "Proponer un resumen breve para compras y operaciones, no un PDF eterno.",
        clientPrompt: "Mándeme algo, pero corto. No tengo tiempo de leer 20 páginas.",
        positiveCriteria: ["reunion", "permiso"],
        negativeCriteria: ["gratis", "monologo"],
        whatGoodLooksLike:
          "Ofrece un one-pager o demo corta alineada al piloto de 3 semanas.",
      },
      {
        key: "cierre",
        label: "Cierre",
        goal: "Agendar mesa de trabajo con día y hora con compras y operaciones.",
        clientPrompt: "Si insiste, el jueves temprano podría ser. ¿Qué necesitaríamos preparar?",
        positiveCriteria: ["reunion", "dia_hora"],
        negativeCriteria: ["monologo", "telegrama"],
        whatGoodLooksLike:
          "Cierra jueves 10:00 con compras + operaciones y lista lo que traerán al piloto.",
      },
    ],
    dimensionGuides: {
      ...defaultDimensionGuides(language),
      apertura_contrato:
        "Se presenta, reconoce importación/distribución y pide permiso en menos de 20 segundos.",
      discovery_escucha:
        "Pregunta por pedidos urgentes, ERP y handoff ventas-almacén antes de hablar de features.",
      dolor_implicacion:
        "Cuantifica entregas perdidas o retrabajo por falta de visibilidad del pipeline.",
      valor_tailor:
        "Conecta Kraken Flow con importación B2B, no con jerga genérica de productividad.",
      compostura_objecion:
        "Valida el ERP actual y propone complemento operativo, no rip-and-replace.",
      cierre_siguiente_paso:
        "Agenda mesa jueves 10:00 con compras y operaciones para piloto de 3 semanas.",
    },
  };
}

export function authoringDraftHasContent(draft: ScenarioAuthoringDraft): boolean {
  return Boolean(
    draft.clientName.trim() ||
      draft.clientTitle.trim() ||
      draft.companyContext.trim() ||
      draft.industry.trim() ||
      draft.productSold.trim() ||
      draft.clientProblem.trim() ||
      draft.objections.some((objection) => objection.trim()),
  );
}
