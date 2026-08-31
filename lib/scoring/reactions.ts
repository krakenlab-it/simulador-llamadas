import type { RoundType } from "@/lib/db/types";
import type { ClientReaction } from "./rondas";

/**
 * Client reply lines keyed by scenario slug, round, and reaction tier.
 * Derived from prototype openings and follow-up prompts.
 */
export const SCENARIO_REACTIONS: Record<
  string,
  Partial<Record<RoundType, Record<ClientReaction, string>>>
> = {
  mariana: {
    apertura: {
      bien: "Tiene un minuto. Hable de visitas a caseta con datos.",
      medio: "¿Quién habla? Estoy entre juntas.",
      mal: "Ya tenemos agencia y caseta. No busco otra cosa.",
    },
    objecion: {
      bien: "Eso suena medible. ¿Qué indicador moverían primero?",
      medio: "Eso ya lo escuché. ¿Qué resultado me trae?",
      mal: "No tengo tiempo para otro discurso genérico.",
    },
    claridad: {
      bien: "Bien. ¿Cómo medirían el avance semana a semana?",
      medio: "Explíqueme en una frase qué medirían.",
      mal: "Sigo sin ver el problema concreto.",
    },
    correo: {
      bien: "Envíe algo breve al correo que le doy.",
      medio: "Mande su correo, pero sea breve.",
      mal: "No quiero más PDFs sin contexto.",
    },
    cierre: {
      bien: "De acuerdo, lo agendo.",
      medio: "Si no hay fecha en la agenda, no hay reunión.",
      mal: "Sin día y hora concretos no avanzamos.",
    },
  },
  rodrigo: {
    apertura: {
      bien: "Dos minutos. Hable de tráfico a tienda.",
      medio: "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
      mal: "Si es otro discurso de branding, cuelgo.",
    },
    objecion: {
      bien: "Interesante enfoque de ROI. Siga.",
      medio: "Eso ya lo escuché. ¿Qué resultado me trae?",
      mal: "Eso no mueve venta por m².",
    },
    claridad: {
      bien: "Ok, ¿qué KPI usarían en piso?",
      medio: "Explíqueme en una frase qué medirían.",
      mal: "Sigo sin ver métrica clara.",
    },
    correo: {
      bien: "Mándeme un resumen corto.",
      medio: "Mande su correo, pero sea breve.",
      mal: "No abro adjuntos largos.",
    },
    cierre: {
      bien: "Queda agendado.",
      medio: "Si no hay fecha en la agenda, no hay reunión.",
      mal: "Sin hora exacta no cierro.",
    },
  },
  efrain: {
    apertura: {
      bien: "El piso está flojo, pero escucho. Hable de gente real.",
      medio: "El piso está flojo. No me interesan los clics.",
      mal: "¿Ustedes miden gente real o solo leads?",
    },
    objecion: {
      bien: "Eso podría ayudar al piso. Detalle.",
      medio: "Eso ya lo escuché. ¿Qué resultado me trae?",
      mal: "No creo en clics.",
    },
    claridad: {
      bien: "Bien, ¿cómo lo medirían en piso?",
      medio: "Explíqueme en una frase qué medirían.",
      mal: "Sigo sin ver el problema concreto.",
    },
    correo: {
      bien: "Envíe algo breve.",
      medio: "Mande su correo, pero sea breve.",
      mal: "No quiero spam.",
    },
    cierre: {
      bien: "Perfecto, nos vemos entonces.",
      medio: "Si no hay fecha en la agenda, no hay reunión.",
      mal: "Sin día y hora no hay reunión.",
    },
  },
};

const DEFAULT_REACTIONS: Record<RoundType, Record<ClientReaction, string>> = {
  apertura: {
    bien: "Adelante, sea concreto.",
    medio: "¿Quién habla?",
    mal: "No tengo tiempo.",
  },
  objecion: {
    bien: "Siga, eso suena razonable.",
    medio: "Eso ya lo escuché. ¿Qué resultado me trae?",
    mal: "No me convence.",
  },
  claridad: {
    bien: "Entiendo. ¿Cómo lo medirían?",
    medio: "Explíqueme en una frase qué medirían.",
    mal: "No queda claro.",
  },
  correo: {
    bien: "De acuerdo, envíe algo breve.",
    medio: "Mande su correo, pero sea breve.",
    mal: "No quiero más correos.",
  },
  cierre: {
    bien: "Queda agendado.",
    medio: "Si no hay fecha en la agenda, no hay reunión.",
    mal: "Sin día y hora concretos no hay reunión.",
  },
};

export function getClientReply(
  scenarioSlug: string,
  roundType: RoundType,
  reaction: ClientReaction,
): string {
  const scenarioReactions = SCENARIO_REACTIONS[scenarioSlug]?.[roundType];
  return scenarioReactions?.[reaction] ?? DEFAULT_REACTIONS[roundType][reaction];
}
