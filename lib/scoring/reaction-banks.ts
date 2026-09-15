import type { RoundType } from "@/lib/db/types";
import type { ClientReaction } from "./rondas";

export type ReactionBank = Partial<
  Record<RoundType, Record<ClientReaction, readonly string[]>>
>;

export const SCENARIO_REACTION_BANKS: Record<string, ReactionBank> = {
  mariana: {
    apertura: {
      bien: [
        "Tiene un minuto. Hable de visitas a caseta con datos.",
        "Un minuto. Si trae números de visitas a caseta, escucho.",
        "Adelante, pero quiero datos de visitas a caseta, no promesas.",
      ],
      medio: [
        "¿Quién habla? Estoy entre juntas.",
        "¿De qué empresa llama? Tengo junta en cinco.",
        "Dígame su nombre y empresa; estoy entre llamadas.",
      ],
      mal: [
        "Ya tenemos agencia y caseta. No busco otra cosa.",
        "No necesitamos otra agencia ni otra caseta.",
        "Con agencia y caseta cubiertos, no veo por qué seguir.",
      ],
    },
    objecion: {
      bien: [
        "Eso suena medible. ¿Qué indicador moverían primero?",
        "Bien, suena con métrica. ¿Cuál moverían primero?",
        "Ok, medible. ¿Qué KPI atacan primero en caseta?",
      ],
      medio: [
        "Eso ya lo escuché. ¿Qué resultado me trae?",
        "Suena parecido a otras llamadas. ¿Qué resultado concreto?",
        "Ya me dijeron algo así. ¿Qué cambia en visitas?",
      ],
      mal: [
        "No tengo tiempo para otro discurso genérico.",
        "Otro pitch genérico no; tengo agenda llena.",
        "Sin tiempo para el mismo discurso de siempre.",
      ],
    },
    claridad: {
      bien: [
        "Bien. ¿Cómo medirían el avance semana a semana?",
        "Entiendo. ¿Qué revisarían cada semana en caseta?",
        "Ok. ¿Cómo reportan avance semanal en visitas?",
      ],
      medio: [
        "Explíqueme en una frase qué medirían.",
        "Resúmalo en una frase: ¿qué medirían?",
        "Una frase: ¿cuál es la métrica clave?",
      ],
      mal: [
        "Sigo sin ver el problema concreto.",
        "Aún no veo el problema en caseta.",
        "No me queda claro qué problema resuelven.",
      ],
    },
    correo: {
      bien: [
        "Envíe algo breve al correo que le doy.",
        "Mande un correo corto con el resumen.",
        "Ok, envíe algo breve y lo reviso.",
      ],
      medio: [
        "Mande su correo, pero sea breve.",
        "Puede escribir, pero máximo un párrafo.",
        "Correo sí, pero sin adjuntos pesados.",
      ],
      mal: [
        "No quiero más PDFs sin contexto.",
        "No abro PDFs sin saber de qué van.",
        "Sin otro documento largo sin contexto.",
      ],
    },
    cierre: {
      bien: [
        "De acuerdo, lo agendo.",
        "Bien, agendemos entonces.",
        "Perfecto, queda en agenda.",
      ],
      medio: [
        "Si no hay fecha en la agenda, no hay reunión.",
        "Sin día en calendario no avanzo.",
        "Necesito fecha en agenda o no sigo.",
      ],
      mal: [
        "Sin día y hora concretos no avanzamos.",
        "Sin hora exacta no reservo reunión.",
        "Día y hora concretos o no hay cita.",
      ],
    },
  },
  rodrigo: {
    apertura: {
      bien: [
        "Dos minutos. Hable de tráfico a tienda.",
        "Tiene dos minutos. Tráfico a tienda, directo.",
        "Adelante dos minutos, pero hable de tráfico en piso.",
      ],
      medio: [
        "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
        "Dos minutos. ¿Cómo impacta tráfico a tienda?",
        "Rápido: ¿qué tiene que ver con venta en piso?",
      ],
      mal: [
        "Si es otro discurso de branding, cuelgo.",
        "Si es branding otra vez, corto aquí.",
        "No otro speech de marca; cuelgo.",
      ],
    },
    objecion: {
      bien: [
        "Interesante enfoque de ROI. Siga.",
        "ROI suena bien. Continúe.",
        "Ok, enfoque de retorno. Siga.",
      ],
      medio: [
        "Eso ya lo escuché. ¿Qué resultado me trae?",
        "Lo mismo que otras agencias. ¿Qué resultado?",
        "Suena repetido. ¿Qué cambia en tienda?",
      ],
      mal: [
        "Eso no mueve venta por m².",
        "Eso no sube venta por metro cuadrado.",
        "Sin impacto en m², no me interesa.",
      ],
    },
    claridad: {
      bien: [
        "Ok, ¿qué KPI usarían en piso?",
        "Bien. ¿Qué KPI en tienda revisarían?",
        "Entiendo. ¿Qué métrica de piso usarían?",
      ],
      medio: [
        "Explíqueme en una frase qué medirían.",
        "Una frase: ¿qué medirían en tienda?",
        "Resuma qué KPI mirarían.",
      ],
      mal: [
        "Sigo sin ver métrica clara.",
        "No veo KPI claro todavía.",
        "Aún sin métrica concreta de piso.",
      ],
    },
    correo: {
      bien: [
        "Mándeme un resumen corto.",
        "Envíe resumen breve por correo.",
        "Correo corto y lo reviso.",
      ],
      medio: [
        "Mande su correo, pero sea breve.",
        "Puede escribir, pero corto.",
        "Correo sí, sin rodeos.",
      ],
      mal: [
        "No abro adjuntos largos.",
        "Sin adjuntos pesados, por favor.",
        "No quiero otro PDF largo.",
      ],
    },
    cierre: {
      bien: [
        "Queda agendado.",
        "Listo, en agenda.",
        "Perfecto, agendado.",
      ],
      medio: [
        "Si no hay fecha en la agenda, no hay reunión.",
        "Sin fecha en calendario, no hay reunión.",
        "Necesito día en agenda.",
      ],
      mal: [
        "Sin hora exacta no cierro.",
        "Sin hora concreta no confirmo.",
        "Hora exacta o no hay cita.",
      ],
    },
  },
  efrain: {
    apertura: {
      bien: [
        "El piso está flojo, pero escucho. Hable de gente real.",
        "Piso flojo, pero si es gente real en sala, escucho.",
        "Hay poco tráfico; hable de visitas reales al piso.",
      ],
      medio: [
        "El piso está flojo. No me interesan los clics.",
        "Piso vacío. Los clics no me sirven.",
        "Poco movimiento en piso; no me vendan clics.",
      ],
      mal: [
        "¿Ustedes miden gente real o solo leads?",
        "¿Traen personas al piso o solo formularios?",
        "¿Es gente en sala o puro lead digital?",
      ],
    },
    objecion: {
      bien: [
        "Eso podría ayudar al piso. Detalle.",
        "Podría subir tráfico en piso. Explique.",
        "Suena útil para el salón. Detalle.",
      ],
      medio: [
        "Eso ya lo escuché. ¿Qué resultado me trae?",
        "Lo mismo de siempre. ¿Qué resultado en piso?",
        "Ya me lo dijeron. ¿Qué cambia en visitas?",
      ],
      mal: [
        "No creo en clics.",
        "Los clics no llenan el piso.",
        "No confío en métricas de clic.",
      ],
    },
    claridad: {
      bien: [
        "Bien, ¿cómo lo medirían en piso?",
        "Ok. ¿Cómo miden visitas en sala?",
        "Entiendo. ¿Qué revisan en piso cada semana?",
      ],
      medio: [
        "Explíqueme en una frase qué medirían.",
        "Una frase: ¿qué medirían en piso?",
        "Resuma la métrica de visitas.",
      ],
      mal: [
        "Sigo sin ver el problema concreto.",
        "No veo el problema en piso todavía.",
        "Aún no queda claro el dolor en sala.",
      ],
    },
    correo: {
      bien: [
        "Envíe algo breve.",
        "Mande correo corto.",
        "Ok, algo breve por correo.",
      ],
      medio: [
        "Mande su correo, pero sea breve.",
        "Correo sí, pero corto.",
        "Puede escribir, sin rodeos.",
      ],
      mal: [
        "No quiero spam.",
        "No más correos masivos.",
        "Sin spam, por favor.",
      ],
    },
    cierre: {
      bien: [
        "Perfecto, nos vemos entonces.",
        "Listo, nos vemos.",
        "De acuerdo, queda la cita.",
      ],
      medio: [
        "Si no hay fecha en la agenda, no hay reunión.",
        "Sin día en agenda no avanzo.",
        "Necesito fecha concreta.",
      ],
      mal: [
        "Sin día y hora no hay reunión.",
        "Sin hora exacta no confirmo.",
        "Día y hora o no hay reunión.",
      ],
    },
  },
};

export const DEFAULT_REACTION_BANKS: Record<
  RoundType,
  Record<ClientReaction, readonly string[]>
> = {
  apertura: {
    bien: ["Adelante, sea concreto.", "Siga, sea directo.", "Ok, concreto."],
    medio: ["¿Quién habla?", "¿De qué empresa?", "¿Quién llama?"],
    mal: ["No tengo tiempo.", "Sin tiempo ahora.", "No puedo hablar."],
  },
  objecion: {
    bien: [
      "Siga, eso suena razonable.",
      "Ok, suena razonable.",
      "Bien, continúe.",
    ],
    medio: [
      "Eso ya lo escuché. ¿Qué resultado me trae?",
      "Suena repetido. ¿Qué resultado?",
      "¿Qué cambia con ustedes?",
    ],
    mal: ["No me convence.", "No me convence todavía.", "Sigo escéptico."],
  },
  claridad: {
    bien: [
      "Entiendo. ¿Cómo lo medirían?",
      "Ok. ¿Cómo lo miden?",
      "Bien. ¿Qué métrica usan?",
    ],
    medio: [
      "Explíqueme en una frase qué medirían.",
      "Una frase: ¿qué medirían?",
      "Resuma la métrica.",
    ],
    mal: ["No queda claro.", "Sigo sin claridad.", "No entiendo aún."],
  },
  correo: {
    bien: [
      "De acuerdo, envíe algo breve.",
      "Ok, mande algo corto.",
      "Envíe resumen breve.",
    ],
    medio: [
      "Mande su correo, pero sea breve.",
      "Correo sí, pero corto.",
      "Puede escribir, sin rodeos.",
    ],
    mal: [
      "No quiero más correos.",
      "Sin más correos, gracias.",
      "No más emails genéricos.",
    ],
  },
  cierre: {
    bien: ["Queda agendado.", "Listo, agendado.", "Perfecto, en agenda."],
    medio: [
      "Si no hay fecha en la agenda, no hay reunión.",
      "Sin fecha en calendario no avanzo.",
      "Necesito día en agenda.",
    ],
    mal: [
      "Sin día y hora concretos no hay reunión.",
      "Sin hora exacta no confirmo.",
      "Día y hora concretos o no hay cita.",
    ],
  },
};
