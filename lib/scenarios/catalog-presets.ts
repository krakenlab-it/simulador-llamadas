import type { RoundType } from "@/lib/db/types";
import type { ClientReaction } from "@/lib/scoring/rondas";
import type { ClinicPresetSlug, ScenarioConfig } from "./types";
import { CLINIC_PRESET_SLUGS } from "./types";

export type CatalogBadge = "hard" | "medium";

/**
 * PREFILLED catalog — single source of truth for the three clinic situations.
 * Names/slugs stay stable (seed + tests). The situations themselves are
 * rewritten so each case is distinct, practice-ready, and not a clone of the others.
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
    indicator: "Visitas a caseta",
    industry: "Desarrollo inmobiliario de vivienda media",
    productSold: "Atribución de visitas a caseta y costo por prospecto calificado",
    temperament: "Escéptica, entre juntas, ya tiene agencia",
    winCriteria:
      "Agenda una revisión de 25 minutos el jueves o viernes, con hora concreta, para ver el tablero de visitas a caseta.",
    practiceBrief:
      "Practica atribuir visitas reales a caseta — no un pitch de branding. Mariana ya tiene agencia y solo abre la agenda si le hablas de CAC y de gente que sí llega al desarrollo.",
    voiceGender: "female",
    pains: [
      "Costo por prospecto +40%",
      "Formularios que no visitan",
      "Espectaculares sin medición",
    ],
    openings: [
      "¿Quién habla? Estoy entre juntas.",
      "Ya tenemos agencia y caseta. No busco otra cosa.",
    ],
    objections: [
      "Ya tenemos agencia y caseta; no voy a pagar otro retainer.",
      "Los formularios suben y la caseta sigue vacía.",
      "Si no me dices cómo mides una visita real, cuelgo.",
    ],
    questionBank: [
      "¿Cuántas de esas visitas a caseta son de gente que ya pidió información?",
      "¿Cómo separan un lead de Facebook de alguien que sí cruzó la caseta?",
      "¿Qué harían la primera semana sin pedirme más presupuesto de pauta?",
      "Si el CAC no baja en 30 días, ¿quién absorbe el riesgo?",
      "¿Tienen un número de visitas calificadas o solo impresiones?",
    ],
    reactions: {
      apertura: {
        bien: "Tiene un minuto. Hable de visitas a caseta con datos, no de marca.",
        medio: "¿Quién habla? Estoy entre juntas.",
        mal: "Ya tenemos agencia y caseta. No busco otra cosa.",
      },
      objecion: {
        bien: "Eso sí se parece a mi CAC. ¿Qué indicador moverían primero en caseta?",
        medio: "Los formularios ya me los vende mi agencia. ¿Qué cambia en la caseta?",
        mal: "Suena a otro retainer. No tengo tiempo para eso.",
      },
      claridad: {
        bien: "Bien. ¿Cómo sabríamos el martes si una visita fue calificada o no?",
        medio: "Dígame en una frase cómo miden una visita real, no un clic.",
        mal: "Sigo oyendo branding. No veo el problema de la caseta.",
      },
      correo: {
        bien: "Mándeme un tablero de una página, no un PDF de 20.",
        medio: "Si es un one-pager de visitas a caseta, lo leo. Si es un brochure, no.",
        mal: "No quiero más decks de agencia. Cuelgo.",
      },
      cierre: {
        bien: "Jueves 10:30. Traiga el tablero de caseta, no un pitch.",
        medio: "Sin día y hora en mi agenda no hay revisión de caseta.",
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
      "Practica vender tráfico a tienda y venta por m². Rodrigo cuelga si oye branding. Cada pregunta suya es de piso, no de awareness.",
    voiceGender: "male",
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
      "¿En cuál de las dos aperturas de proximidad empezarían y por qué?",
      "¿Qué número de tickets por hora esperan el primer fin de semana?",
      "¿Cómo evitan canibalizar la sucursal de a dos cuadras?",
      "¿Quién en piso les confirma que el tráfico no es solo gente preguntando precio?",
      "Si el m² no se mueve en 21 días, ¿qué apagan?",
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
        medio: "Si no hay hora el lunes o martes, no hay revisión de piso.",
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
      "Practica traducir digital a gente en el showroom. Efraín no cree en clics. Gana si agenda con día y hora un plan de piso, no un dashboard de leads.",
    voiceGender: "male",
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
      "¿Cómo evitan que el lead se quede en WhatsApp y no cruce la puerta?",
      "¿Qué modelo o demostración pondrían en el piso esa semana?",
      "Si el sábado sigue vacío, ¿qué cambian el lunes?",
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
        medio: "Sin día y hora no hay visita al showroom.",
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
  };
}
