/**
 * Three fixed client personas (v1). Matches DB seed + HTML prototype.
 */

export type ClientBadge = "hard" | "medium";

export interface ClientPersona {
  id: string;
  slug: string;
  name: string;
  title: string;
  company: string;
  difficulty: string;
  badge: ClientBadge;
  indicator: string;
  pains: string[];
  openings: [string, string];
}

export const CLIENTS: readonly ClientPersona[] = [
  {
    id: "mariana",
    slug: "mariana",
    name: "Mariana Escobedo",
    title: "Directora de Mercadotecnia",
    company: "Desarrolladora de vivienda media",
    difficulty: "Difícil",
    badge: "hard",
    indicator: "Visitas a caseta",
    pains: [
      "Costo por prospecto +40%",
      "Formularios que no visitan",
      "Espectaculares sin medición",
    ],
    openings: [
      "¿Quién habla? Estoy entre juntas.",
      "Ya tenemos agencia y caseta. No busco otra cosa.",
    ],
  },
  {
    id: "rodrigo",
    slug: "rodrigo",
    name: "Rodrigo Nava",
    title: "Gerente de Medios",
    company: "Cadena nacional de farmacias",
    difficulty: "Muy difícil",
    badge: "hard",
    indicator: "Tráfico a tienda / venta por m²",
    pains: ["Aperturas de proximidad que no levantan"],
    openings: [
      "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
      "Si es otro discurso de branding, cuelgo.",
    ],
  },
  {
    id: "efrain",
    slug: "efrain",
    name: "Efraín Loera",
    title: "Director Comercial",
    company: "Grupo distribuidor automotriz",
    difficulty: "Media",
    badge: "medium",
    indicator: "Piso con menos gente",
    pains: ["No cree en clics"],
    openings: [
      "El piso está flojo. No me interesan los clics.",
      "¿Ustedes miden gente real o solo leads?",
    ],
  },
] as const;

export function getClientBySlug(slug: string): ClientPersona | undefined {
  return CLIENTS.find((c) => c.slug === slug);
}
