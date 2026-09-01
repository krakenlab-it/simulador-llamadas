import type { TranscriptLine } from "@/lib/scoring/types";

export interface FixtureTranscript {
  name: string;
  lines: TranscriptLine[];
  industry: string;
  productSold: string;
  clientProblem: string;
}

export const GOOD_DISCOVERY_TRANSCRIPT: FixtureTranscript = {
  name: "good_discovery",
  industry: "gimnasio boutique",
  productSold: "membresía anual premium",
  clientProblem: "baja retención de socios después del mes tres",
  lines: [
    {
      role: "client",
      text: "¿Quién habla? Estoy entre clases y no tengo mucho tiempo.",
    },
    {
      role: "trainee",
      text: "Hola, soy Laura de FitPro. ¿Le robo dos minutos? Antes de proponer nada, ¿qué le está costando más hoy con la retención de socios?",
    },
    {
      role: "client",
      text: "Muchos se van después del tercer mes. No sé si es precio o experiencia.",
    },
    {
      role: "trainee",
      text: "Entiendo. ¿Qué ha probado ya para retenerlos y qué resultado vio? Si la baja retención sigue igual seis meses, ¿qué impacto tendría en ingresos del gimnasio?",
    },
    {
      role: "client",
      text: "Perderíamos casi dos salones llenos al año.",
    },
    {
      role: "trainee",
      text: "Gracias por la claridad. En su gimnasio boutique mediríamos retención semana a semana con cohortes, no con discurso genérico. ¿Le parece el jueves a las 10 revisar un plan piloto de 30 días?",
    },
  ],
};

export const FEATURE_DUMP_TRANSCRIPT: FixtureTranscript = {
  name: "feature_dump",
  industry: "banco regional",
  productSold: "línea de crédito PYME",
  clientProblem: "flujo de caja estacional",
  lines: [
    {
      role: "client",
      text: "Ya tengo banco. ¿Qué me ofrece usted?",
    },
    {
      role: "trainee",
      text: "Tenemos la mejor plataforma, incluye app, reportes, módulo de riesgo, tasas competitivas, onboarding digital y soporte 24/7. Somos líderes en PYME.",
    },
    {
      role: "client",
      text: "Suena a folleto. ¿Y mi flujo de caja?",
    },
    {
      role: "trainee",
      text: "Nuestra solución tiene integración ERP, scoring automático, dashboard ejecutivo y API abierta. Muchos clientes eligen nuestro paquete premium.",
    },
  ],
};

export const VAGUE_CLOSE_TRANSCRIPT: FixtureTranscript = {
  name: "vague_close",
  industry: "aseguradora",
  productSold: "póliza empresarial",
  clientProblem: "siniestralidad alta en flota",
  lines: [
    {
      role: "client",
      text: "Mire, la siniestralidad nos está comiendo el margen.",
    },
    {
      role: "trainee",
      text: "Comprendo el reto de siniestralidad en su flota. ¿Qué conductores concentran más incidentes hoy?",
    },
    {
      role: "client",
      text: "Los repartidores nuevos, sobre todo en temporada alta.",
    },
    {
      role: "trainee",
      text: "Podríamos verlo en algún momento la próxima semana para platicar más del tema cuando tenga tiempo.",
    },
  ],
};

export const STEAMROLLED_OBJECTION_TRANSCRIPT: FixtureTranscript = {
  name: "steamrolled_objection",
  industry: "gimnasio",
  productSold: "programa de retención",
  clientProblem: "alta deserción en enero",
  lines: [
    {
      role: "client",
      text: "No tengo presupuesto para esto ahora.",
    },
    {
      role: "trainee",
      text: "Eso no importa, nuestro programa se paga solo en dos meses. Debe contratar ya o se quedará atrás frente a la competencia.",
    },
    {
      role: "client",
      text: "No me gusta esa presión.",
    },
    {
      role: "trainee",
      text: "Es la realidad del mercado. Firmamos hoy y arrancamos.",
    },
  ],
};

export const FIXTURE_TRANSCRIPTS = [
  GOOD_DISCOVERY_TRANSCRIPT,
  FEATURE_DUMP_TRANSCRIPT,
  VAGUE_CLOSE_TRANSCRIPT,
  STEAMROLLED_OBJECTION_TRANSCRIPT,
] as const;
