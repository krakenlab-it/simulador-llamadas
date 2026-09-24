import type { CatalogClientPackSeed } from "@/lib/agent/client-layer";
import {
  defaultDimensionGuides,
  defaultScenarioCallType,
  defaultScenarioLanguage,
  emptyAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "./authoring";
import { buildDefaultRounds } from "./defaults";

export const EXAMPLE_PACK_IDS = [
  "kraken-flow",
  "me-we",
  "wellness",
  "global-green",
] as const;
export type ExamplePackId = (typeof EXAMPLE_PACK_IDS)[number];

export interface ExamplePack {
  id: ExamplePackId;
  label: string;
  practiceBrief: string;
  clientPack: CatalogClientPackSeed;
  draft: ScenarioAuthoringDraft;
}

function draftFromFields(
  fields: Pick<
    ScenarioAuthoringDraft,
    | "industry"
    | "productSold"
    | "clientName"
    | "clientTitle"
    | "companyContext"
    | "temperament"
    | "difficultyLabel"
    | "clientProblem"
    | "objections"
    | "winCriteria"
  > & { rounds?: ScenarioAuthoringDraft["rounds"] },
): ScenarioAuthoringDraft {
  const language = defaultScenarioLanguage();
  const base = emptyAuthoringDraft(language);
  const rounds =
    fields.rounds ??
    buildDefaultRounds(
      fields.industry,
      fields.productSold,
      fields.clientProblem,
      fields.temperament,
    );
  return {
    ...base,
    ...fields,
    language,
    callType: defaultScenarioCallType(),
    rounds,
    dimensionGuides: defaultDimensionGuides(language),
  };
}

const KRAKEN_FLOW_DRAFT = draftFromFields({
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
    "Mesa de trabajo el jueves a las 10 con compras y operaciones para un piloto de 3 semanas.",
  rounds: [
    {
      key: "apertura",
      label: "Apertura",
      goal: "Presentarse, reconocer la operación de importación y pedir permiso.",
      clientPrompt:
        "¿Quién habla? Estoy entre proveedores y un contenedor que entra hoy.",
      positiveCriteria: ["reconocimiento", "problema", "presentacion"],
      negativeCriteria: ["monologo", "telegrama"],
      whatGoodLooksLike:
        "Saludo breve, menciona importación y pide 2 minutos sin pitch genérico.",
    },
    {
      key: "objecion",
      label: "Objeción",
      goal: "Validar el ERP sin pelear y volver al cuello de botella real.",
      clientPrompt:
        "Ya pagamos ERP y no vamos a duplicar captura. ¿Qué cambia con Kraken Flow?",
      positiveCriteria: ["reconocimiento", "jerga", "problema"],
      negativeCriteria: ["descalifica", "monologo"],
      whatGoodLooksLike:
        "Reconoce el ERP y habla de visibilidad ventas-almacén, no de reemplazar todo.",
    },
    {
      key: "claridad",
      label: "Claridad",
      goal: "Nombrar el costo de pedidos urgentes atascados.",
      clientPrompt:
        "¿Qué resultado concreto veríamos en importación si esto funciona?",
      positiveCriteria: ["problema", "medicion"],
      negativeCriteria: ["monologo", "telegrama"],
      whatGoodLooksLike:
        "Habla de entregas, pedidos urgentes y una métrica operativa clara.",
    },
    {
      key: "correo",
      label: "Correo",
      goal: "Proponer un resumen corto para compras y operaciones.",
      clientPrompt: "Mándeme algo, pero corto. No leo 20 páginas.",
      positiveCriteria: ["reunion", "permiso"],
      negativeCriteria: ["gratis", "monologo"],
      whatGoodLooksLike: "Ofrece un one-pager alineado al piloto de 3 semanas.",
    },
    {
      key: "cierre",
      label: "Cierre",
      goal: "Agendar mesa con día y hora.",
      clientPrompt:
        "Si insiste, el jueves temprano podría ser. ¿Qué hay que preparar?",
      positiveCriteria: ["reunion", "dia_hora"],
      negativeCriteria: ["monologo", "telegrama"],
      whatGoodLooksLike:
        "Cierra jueves 10:00 con compras y operaciones para el piloto.",
    },
  ],
});

export const EXAMPLE_PACKS: Record<ExamplePackId, ExamplePack> = {
  "kraken-flow": {
    id: "kraken-flow",
    label: "Kraken Flow",
    practiceBrief:
      "Valeria compra para una importadora. Ya tiene ERP. Gana si agenda mesa el jueves a las 10 para un piloto de 3 semanas.",
    clientPack: {
      decisionRole: "decisor",
      howTheyWorkToday: "ERP de siempre; ventas y almacén no se ven el pipeline",
      onTheirMind: "Un contenedor entra hoy; no quiere otro sistema",
      allowedFacts: [
        "Pedidos urgentes atascados",
        "Entregas perdidas por falta de visibilidad",
        "Ya pagaron ERP",
      ],
      forbiddenClaims: [
        "reemplazar el ERP",
        "garantía de entregas",
        "cifras inventadas de importación",
      ],
      realObjection: "Ya pagó ERP y no quiere otra captura para ventas",
      grantConditions:
        "Que hablen de visibilidad ventas-almacén, no de cambiar el ERP",
      sellerObjective:
        "Mesa el jueves a las 10 con compras y operaciones, piloto 3 semanas",
    },
    draft: KRAKEN_FLOW_DRAFT,
  },
  "me-we": {
    id: "me-we",
    label: "Me We",
    practiceBrief:
      "Practica vender comunidad, no una app. Camila solo abre agenda si hablas de retención de miembros y de un piloto medible.",
    clientPack: {
      decisionRole: "influenciador",
      howTheyWorkToday: "WhatsApp y eventos sueltos; no miden quién se queda",
      onTheirMind: "La comunidad se enfría a los 30 días",
      allowedFacts: [
        "Retención de miembros a 30 días",
        "Eventos que no se convierten en hábito",
        "Ya probaron una app genérica",
      ],
      forbiddenClaims: [
        "garantía de membresías",
        "números de usuarios inventados",
        "nombres de otras comunidades",
      ],
      realObjection: "Ya probaron una app y la gente no volvió",
      grantConditions: "Que midan hábito semanal, no descargas",
      sellerObjective:
        "Una llamada el martes a las 9 para armar un piloto de 4 semanas",
    },
    draft: draftFromFields({
      industry: "Comunidad y membresías",
      productSold: "Me We — comunidad con hábito semanal medible",
      clientName: "Camila Rivas",
      clientTitle: "Head de Comunidad",
      companyContext: "Me We · Ciudad de México",
      temperament: "Cercana, pero cansa el discurso de app",
      difficultyLabel: "Media",
      clientProblem:
        "Los miembros entran con ganas y a los 30 días desaparecen. Los eventos no se vuelven hábito.",
      objections: [
        "Ya probaron una app y la gente no volvió",
        "Si no mides quién se queda, no me sirve",
      ],
      winCriteria:
        "Agenda una llamada el martes a las 9 para armar un piloto de 4 semanas con un hábito semanal.",
    }),
  },
  wellness: {
    id: "wellness",
    label: "Wellness",
    practiceBrief:
      "Gimnasio de proximidad. Habla de retención y clases que sí se llenan. No vendas marca wellness.",
    clientPack: {
      decisionRole: "decisor",
      howTheyWorkToday: "Pase libre y promociones; la gente no vuelve a clase",
      onTheirMind: "El piso se ve vacío a las 18:00",
      allowedFacts: [
        "Baja retención a 60 días",
        "Clases de las 18:00 a media",
        "Ya pagó pauta de marca",
      ],
      forbiddenClaims: [
        "garantía de socios",
        "cifras de retención inventadas",
        "nombres de cadenas competidoras",
      ],
      realObjection: "Pagó pauta de marca y el piso sigue flojo a las 18:00",
      grantConditions: "Que hablen de asistencia a clase, no de branding",
      sellerObjective:
        "Clase prueba o revisión el viernes a las 18, con hora concreta",
    },
    draft: draftFromFields({
      industry: "Gimnasios y wellness",
      productSold: "Retención de socios y llenado de clases de las 18:00",
      clientName: "Laura Méndez",
      clientTitle: "Gerente de Sucursal",
      companyContext: "Cadena de gimnasios de proximidad",
      temperament: "Impaciente, corta discurso de marca",
      difficultyLabel: "Media",
      clientProblem:
        "Baja retención a 60 días. Las clases de las 18:00 no se llenan aunque ya pagó pauta.",
      objections: [
        "Ya pagué branding y el piso sigue flojo",
        "Si no llena la clase de las 18, no me sirve",
      ],
      winCriteria:
        "Deja una clase prueba o revisión el viernes a las 18, con hora concreta.",
    }),
  },
  "global-green": {
    id: "global-green",
    label: "Global Green",
    practiceBrief:
      "Compras de sostenibilidad. No vendas ‘ser verdes’. Agenda una revisión de proveedores con día y hora.",
    clientPack: {
      decisionRole: "guardian",
      howTheyWorkToday: "Excel de proveedores y un reporte anual de ESG",
      onTheirMind: "Auditoría el próximo trimestre; no quiere otro slide deck",
      allowedFacts: [
        "Reporte ESG anual",
        "Proveedores sin evidencia de origen",
        "Auditoría el próximo trimestre",
      ],
      forbiddenClaims: [
        "certificación garantizada",
        "nombres de auditores",
        "cifras de CO2 inventadas",
      ],
      realObjection: "Ya tienen reporte ESG y no quieren otro deck",
      grantConditions:
        "Que hablen de evidencia de origen por proveedor, no de marca verde",
      sellerObjective:
        "Revisión el miércoles a las 16 con compras, hora concreta",
    },
    draft: draftFromFields({
      industry: "Sostenibilidad y compras",
      productSold: "Evidencia de origen por proveedor para la auditoría ESG",
      clientName: "Andrés Peña",
      clientTitle: "Gerente de Compras Sostenibles",
      companyContext: "Global Green · corporativo",
      temperament: "Formal, desconfía de decks verdes",
      difficultyLabel: "Alta",
      clientProblem:
        "El reporte ESG es anual y los proveedores no traen evidencia de origen. La auditoría llega el próximo trimestre.",
      objections: [
        "Ya tenemos el reporte ESG",
        "No quiero otro deck de marca verde",
      ],
      winCriteria:
        "Acepta una revisión el miércoles a las 16 con compras, con hora concreta.",
    }),
  },
};

function withPackOnDraft(pack: ExamplePack): ExamplePack {
  return {
    ...pack,
    draft: { ...pack.draft, clientPack: pack.clientPack },
  };
}

export function listExamplePacks(): ExamplePack[] {
  return EXAMPLE_PACK_IDS.map((id) => withPackOnDraft(EXAMPLE_PACKS[id]));
}

export function getExamplePack(id: string): ExamplePack | undefined {
  if (!(EXAMPLE_PACK_IDS as readonly string[]).includes(id)) return undefined;
  return withPackOnDraft(EXAMPLE_PACKS[id as ExamplePackId]);
}
