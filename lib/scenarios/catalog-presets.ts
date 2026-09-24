import type { CatalogClientPackSeed } from "@/lib/agent/client-layer";
import type { RoundType } from "@/lib/db/types";
import type { ClientReaction } from "@/lib/scoring/rondas";
import type { ClinicPresetSlug, ScenarioConfig } from "./types";
import { CLINIC_PRESET_SLUGS } from "./types";

export type CatalogBadge = "hard" | "medium";

/** Humă 2023: block (push to end) vs stall (delay) vs curious-but-guarded. */
export const BUYER_RESISTANCE_STYLES = [
  "block",
  "stall",
  "curious_guarded",
] as const;
export type BuyerResistanceStyle = (typeof BUYER_RESISTANCE_STYLES)[number];

/**
 * After the trainee already got a yes on the presentation, the live client
 * confirms the offered day/time. Pack + motor share this so stock defaults
 * do not loop «sin día y hora… local» (KAN-94).
 */
export const SLOT_GRANT_AFTER_PRESENTATION =
  "Si ya aceptaste la presentación y el vendedor ofrece un día y hora concretos (por ejemplo viernes a las 9 de la mañana), confirma ESE slot y avanza. No pidas otro horario ni digas que sin día y hora no hay revisión.";

/**
 * PREFILLED catalog — single source of truth for the three clinic situations.
 * Names/slugs stay stable (seed + tests). Each case is a distinct buyer with
 * a real pack, not a cloned stub.
 */
export interface CatalogPreset {
  slug: ClinicPresetSlug;
  name: string;
  title: string;
  company: string;
  difficulty: string;
  badge: CatalogBadge;
  indicator: string;
  industry: string;
  productSold: string;
  temperament: string;
  winCriteria: string;
  practiceBrief: string;
  voiceGender: "female" | "male";
  /** Stable Humă-style resistance for team compare — not random mid-call. */
  resistanceStyle: BuyerResistanceStyle;
  /** Jaime pack extras — what the live client is allowed to know. */
  clientPack: CatalogClientPackSeed;
  pains: string[];
  openings: [string, string];
  objections: string[];
  questionBank: string[];
  reactions: Record<RoundType, Record<ClientReaction, string>>;
}

export const CATALOG_PRESETS: Record<ClinicPresetSlug, CatalogPreset> = {
  mariana: {
    slug: "mariana",
    name: "Mariana Escobedo",
    title: "Directora de Mercadotecnia",
    company: "Desarrolladora de vivienda media",
    difficulty: "Difícil",
    badge: "hard",
    indicator: "Visitas al local",
    industry: "Desarrollo inmobiliario de vivienda media",
    productSold: "Atribución de visitas al local y costo por prospecto calificado",
    temperament: "Escéptica, entre juntas, ya tiene agencia",
    winCriteria:
      "Agenda una revisión de 25 minutos el jueves o viernes, con hora concreta, para ver el tablero de visitas al local.",
    practiceBrief:
      "Mariana ya paga agencia y no ve gente en el local. No le vendas marca. Atribuye visitas reales, habla de CAC y cierra jueves o viernes con hora para el tablero. Si acepta la presentación y ofreces un slot, ella lo confirma — no te lo vuelve a pedir.",
    voiceGender: "female",
    resistanceStyle: "stall",
    clientPack: {
      decisionRole: "decisor",
      howTheyWorkToday:
        "Agencia de branding y local propio; el formulario «llega» y nadie cruza el desarrollo",
      onTheirMind:
        "Salió de un comité: el CAC subió 40% y el sábado el local estuvo vacío otra vez",
      allowedFacts: [
        "Costo por prospecto +40% este trimestre",
        "Formularios que no visitan el local",
        "Espectaculares en periférico sin medición",
        "Ella firma la revisión de 25 minutos",
      ],
      forbiddenClaims: [
        "garantía de visitas al local",
        "nombres de agencias o competidores",
        "cifras de ventas del desarrollo",
      ],
      realObjection:
        "Ya pagó agencia y no ve gente en el local; no quiere volver a pagar por likes",
      grantConditions: `Que expliquen cómo se mide una visita real al local, no un clic. ${SLOT_GRANT_AFTER_PRESENTATION}`,
      sellerObjective:
        "Conseguir una revisión de 25 minutos esta semana con día y hora",
    },
    pains: [
      "Costo por prospecto +40%",
      "Formularios que no visitan",
      "Espectaculares sin medición",
    ],
    openings: [
      "¿Quién habla? Estoy entre juntas.",
      "Ya tenemos agencia y local. No busco otra cosa.",
    ],
    objections: [
      "Ya tenemos agencia y local; no voy a pagar otro retainer.",
      "Los formularios suben y el local sigue vacío.",
      "Si no me dices cómo mides una visita real, cuelgo.",
    ],
    questionBank: [
      "De los que llenan el formulario, ¿cuántos cruzan el local el sábado?",
      "Mi agencia me vende leads. ¿Ustedes me venden gente en el desarrollo?",
      "Si el CAC no baja en treinta días, ¿quién pone el dinero?",
      "¿Qué apagan la primera semana sin pedirme más pauta?",
      "No me hable de impresiones. ¿Cuál es el número de visitas calificadas?",
    ],
    reactions: {
      apertura: {
        bien: "Tiene un minuto. Hable de visitas al local con datos, no de marca.",
        medio: "¿Quién habla? Estoy entre juntas.",
        mal: "Ya tenemos agencia y local. No busco otra cosa.",
      },
      objecion: {
        bien: "Eso sí se parece a mi CAC. ¿Qué indicador moverían primero en el local?",
        medio: "Los formularios ya me los vende mi agencia. ¿Qué cambia en el local?",
        mal: "Suena a otro retainer. No tengo tiempo para eso.",
      },
      claridad: {
        bien: "Bien. ¿Cómo sabríamos el martes si una visita fue calificada o no?",
        medio: "Dígame en una frase cómo miden una visita real, no un clic.",
        mal: "Sigo oyendo branding. No veo el problema del local.",
      },
      correo: {
        bien: "Mándeme un tablero de una página, no un PDF de 20.",
        medio: "Si es un one-pager de visitas al local, lo leo. Si es un brochure, no.",
        mal: "No quiero más decks de agencia. Cuelgo.",
      },
      cierre: {
        bien: "Jueves 10:30. Traiga el tablero del local, no un pitch.",
        medio:
          "Si ya me dio jueves o viernes con hora, lo dejo en Outlook. Traiga el tablero de una página.",
        mal: "No agendo nada sin una hora concreta. Adiós.",
      },
    },
  },
  rodrigo: {
    slug: "rodrigo",
    name: "Rodrigo Nava",
    title: "Gerente de Medios",
    company: "Cadena nacional de farmacias",
    difficulty: "Muy difícil",
    badge: "hard",
    indicator: "Tráfico a tienda / venta por m²",
    industry: "Retail de farmacias de proximidad",
    productSold: "Incremento de tráfico a tienda y venta por metro cuadrado",
    temperament: "Impaciente, corta branding, exige piso",
    winCriteria:
      "Deja un slot de 20 minutos el lunes o martes, con hora, para revisar el plan de dos aperturas de proximidad.",
    practiceBrief:
      "Rodrigo filtra para el director. Tiene dos minutos y dos aperturas de proximidad que no levantan. Si oye marca, cuelga. Habla de tickets y m²; él te puede dejar 20 minutos lunes o martes — el director firma después. Si ya dijo que sí a ver el plan y ofreces hora, confirma y se lo pasa.",
    voiceGender: "male",
    resistanceStyle: "block",
    clientPack: {
      decisionRole: "influenciador",
      howTheyWorkToday:
        "Pauta nacional de awareness; las dos aperturas de proximidad no levantan ticket y el director aún no vio un plan de piso",
      onTheirMind:
        "Le quedan dos minutos antes del reporte de apertura; si oye branding cuelga",
      allowedFacts: [
        "Dos aperturas de proximidad que no levantan",
        "Ya pagó awareness nacional",
        "Mide venta por m² y tickets de piso",
        "El director firma presupuesto; Rodrigo solo cede 20 minutos",
      ],
      forbiddenClaims: [
        "garantía de venta por m²",
        "nombres de cadenas competidoras",
        "cifras inventadas de tickets",
      ],
      realObjection:
        "Pagó awareness y el piso de las aperturas sigue flojo; no cree en marca y no va a quemar al director con otro video",
      grantConditions: `Que hablen de tickets y m² en las dos aperturas, no de awareness. Tú no firmas presupuesto: si el plan convence, se lo pasas al director. ${SLOT_GRANT_AFTER_PRESENTATION}`,
      sellerObjective:
        "Dejar 20 minutos el lunes o martes, con hora, para el plan de las dos aperturas",
    },
    pains: ["Aperturas de proximidad que no levantan"],
    openings: [
      "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
      "Si es otro discurso de branding, cuelgo.",
    ],
    objections: [
      "Las aperturas de proximidad no levantan y ya pagué awareness.",
      "Si no mueve venta por m², no me sirve.",
      "No voy a oír otro discurso de marca nacional.",
    ],
    questionBank: [
      "¿En cuál de las dos aperturas de proximidad empiezan y por qué esa?",
      "El sábado a las 11, ¿qué número de tickets por hora me dejan?",
      "La sucursal de a dos cuadras ya existe. ¿Cómo no la canibalizan?",
      "¿Quién en piso les confirma que no es gente preguntando precio?",
      "Si el m² no se mueve en 21 días, ¿qué apagan antes de hablarle al director?",
    ],
    reactions: {
      apertura: {
        bien: "Dos minutos. Hable de tráfico a tienda, no de marca.",
        medio: "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
        mal: "Si es otro discurso de branding, cuelgo.",
      },
      objecion: {
        bien: "Eso sí toca venta por m². Siga con las aperturas de proximidad.",
        medio: "Awareness ya lo pagué. ¿Qué ticket extra me deja el fin de semana?",
        mal: "Eso no mueve venta por m². Adiós.",
      },
      claridad: {
        bien: "Ok. ¿Qué KPI de piso usan el sábado a las 11?",
        medio: "Una frase: ¿tickets, m² o gente preguntando precio?",
        mal: "Sigo sin una métrica de piso. Cuelgo.",
      },
      correo: {
        bien: "Mándeme un plan de dos sucursales, una hoja, sin marca.",
        medio: "Si cabe en un WhatsApp de tres líneas de piso, lo veo.",
        mal: "No abro presentaciones de branding. No insista.",
      },
      cierre: {
        bien: "Lunes 8:15. Traiga las dos aperturas, no un video de marca.",
        medio:
          "Si ya hay lunes o martes con hora, se lo paso al director. No necesito otro discurso.",
        mal: "Sin hora exacta no cierro. Cuelgo.",
      },
    },
  },
  efrain: {
    slug: "efrain",
    name: "Efraín Loera",
    title: "Director Comercial",
    company: "Grupo distribuidor automotriz",
    difficulty: "Media",
    badge: "medium",
    indicator: "Piso con menos gente",
    industry: "Distribución automotriz y piso de ventas",
    productSold: "Gente real en showroom y citas que sí llegan al piso",
    temperament: "Directo, desconfía de clics, habla de piso",
    winCriteria:
      "Acepta una visita o llamada el miércoles, con hora, para ver el plan de gente en piso — no un reporte de leads.",
    practiceBrief:
      "Efraín cuida el showroom: sin él no hay visita al dueño. Marketing le tira clics; el sábado el piso está vacío. Traduce digital a cabezas en piso y agenda miércoles con hora. Si ya aceptó ver el plan y ofreces el slot, confirma — no te recita que el piso no espera.",
    voiceGender: "male",
    resistanceStyle: "curious_guarded",
    clientPack: {
      decisionRole: "guardian",
      howTheyWorkToday:
        "Marketing le manda leads y sesiones web; él decide quién pisa el showroom y quién habla con el dueño",
      onTheirMind:
        "El sábado el piso estuvo flojo otra vez; no va a gastar la agenda del dueño en un dashboard",
      allowedFacts: [
        "Piso con menos gente el sábado",
        "Leads que no cruzan la puerta",
        "Desconfía de clics y sesiones web",
        "Filtra visitas; el dueño no se sienta si él no abre la puerta",
      ],
      forbiddenClaims: [
        "garantía de gente en piso",
        "nombres de otras agencias",
        "cifras de leads inventadas",
      ],
      realObjection:
        "Marketing presume clics y el sábado el showroom sigue vacío; él no deja pasar a quien vende internet",
      grantConditions: `Que traduzcan digital a cabezas en piso el sábado, no a un dashboard. Tú filtras: sin gente real no hay dueño. ${SLOT_GRANT_AFTER_PRESENTATION}`,
      sellerObjective:
        "Una visita o llamada el miércoles, con hora, para el plan de gente en piso",
    },
    pains: ["No cree en clics"],
    openings: [
      "El piso está flojo. No me interesan los clics.",
      "¿Ustedes miden gente real o solo leads?",
    ],
    objections: [
      "El piso está flojo y marketing me presume clics.",
      "Los leads no se aparecen en el showroom.",
      "Si no hay gente real el sábado, el reporte no me sirve.",
    ],
    questionBank: [
      "¿Cuánta gente extra en piso el sábado, no cuántos clics?",
      "¿Quién recibe a esa gente: el closer o el hostess?",
      "El lead se queda en WhatsApp y no cruza. ¿Ustedes qué hacen distinto?",
      "¿Qué modelo o demostración pondrían en el piso esa semana?",
      "Si el sábado sigue vacío, ¿qué cambian el lunes antes de pedirme al dueño?",
    ],
    reactions: {
      apertura: {
        bien: "El piso está flojo, pero escucho. Hable de gente real, no de clics.",
        medio: "El piso está flojo. No me interesan los clics.",
        mal: "¿Ustedes miden gente real o solo leads?",
      },
      objecion: {
        bien: "Eso sí puede llenar el showroom. Detalle cómo llegan el sábado.",
        medio: "Marketing ya me mandó leads. ¿Cuántos cruzan la puerta?",
        mal: "No creo en clics. Si no hay gente, no sigo.",
      },
      claridad: {
        bien: "Bien. ¿Cómo cuentan cabezas en piso, no sesiones web?",
        medio: "Una frase: gente en piso o leads en el CRM.",
        mal: "Sigo oyendo internet. No veo el piso.",
      },
      correo: {
        bien: "Mándeme el plan del sábado, una hoja, sin impresiones.",
        medio: "Si es un plan de piso, lo leo. Si es un reporte de clics, no.",
        mal: "No quiero spam de leads. El piso sigue vacío.",
      },
      cierre: {
        bien: "Miércoles 17:00. Traiga el plan de gente en piso.",
        medio:
          "Si ya dijo miércoles con hora, confirmo. El piso no espera un «luego les aviso».",
        mal: "Sin hora no hay reunión. El piso no espera.",
      },
    },
  },
};

export function listCatalogPresets(): CatalogPreset[] {
  return CLINIC_PRESET_SLUGS.map((slug) => CATALOG_PRESETS[slug]);
}

export function getCatalogPreset(slug: string): CatalogPreset | undefined {
  if (!(CLINIC_PRESET_SLUGS as readonly string[]).includes(slug)) return undefined;
  return CATALOG_PRESETS[slug as ClinicPresetSlug];
}

export function catalogQuestionBanks(): Record<ClinicPresetSlug, string[]> {
  return {
    mariana: [...CATALOG_PRESETS.mariana.questionBank],
    rodrigo: [...CATALOG_PRESETS.rodrigo.questionBank],
    efrain: [...CATALOG_PRESETS.efrain.questionBank],
  };
}

export function questionsOverlapAcrossPresets(): string[] {
  const seen = new Map<string, ClinicPresetSlug[]>();
  for (const preset of listCatalogPresets()) {
    for (const question of preset.questionBank) {
      const key = question.trim().toLowerCase();
      const owners = seen.get(key) ?? [];
      owners.push(preset.slug);
      seen.set(key, owners);
    }
  }
  return [...seen.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([question]) => question);
}

export function reactionsOverlapAcrossPresets(): string[] {
  const seen = new Map<string, string[]>();
  for (const preset of listCatalogPresets()) {
    for (const round of Object.values(preset.reactions)) {
      for (const line of Object.values(round)) {
        const key = line.trim().toLowerCase();
        const owners = seen.get(key) ?? [];
        owners.push(preset.slug);
        seen.set(key, owners);
      }
    }
  }
  return [...seen.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([line]) => line);
}

export function catalogReactionLines(): string[] {
  return listCatalogPresets().flatMap((preset) =>
    Object.values(preset.reactions).flatMap((round) => Object.values(round)),
  );
}

export function buildCatalogScenarioConfig(slug: string): ScenarioConfig | null {
  const preset = getCatalogPreset(slug);
  if (!preset) return null;

  return {
    industry: preset.industry,
    productSold: preset.productSold,
    clientProblem: preset.pains.join(". "),
    objections: [...preset.objections],
    winCriteria: preset.winCriteria,
    temperament: preset.temperament,
    rounds: [],
    criteria: [],
    globalPositiveCriteria: ["problema", "medicion", "reunion"],
    openingLines: [...preset.openings],
    language: "es",
    callType: "fria",
    dimensionGuides: {},
    clientPack: { ...preset.clientPack },
  };
}
