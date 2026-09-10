export const OTHER_OPTION_VALUE = "__otro__";

export const INDUSTRY_OPTIONS = [
  "Banca y servicios financieros",
  "Seguros",
  "Retail y tiendas departamentales",
  "SaaS B2B",
  "Farmacéuticas",
  "Automotriz y refacciones",
  "Vivienda y desarrollo inmobiliario",
  "Educación privada",
  "Hospitalidad y hoteles",
  "Logística y transporte",
  "Alimentos y bebidas",
  "Telecomunicaciones",
  "Energía y utilities",
  "Agroindustria",
  "Clínicas y salud privada",
  "Gimnasios y wellness",
  "Belleza y estética",
  "Construcción e infraestructura",
  "Servicios profesionales",
  "E-commerce y marketplaces",
  "Manufactura",
  "Importación y distribución",
  "Tecnología industrial",
  "Medios y publicidad",
  "Minería y recursos naturales",
  "Textil y confección",
  "Turismo y viajes",
  "Legal y compliance",
  "Call center y BPO",
  "Cooperativas y sector social",
] as const;

export const TEMPERAMENT_OPTIONS = [
  "Escéptico, poco tiempo",
  "Amable pero cauteloso",
  "Gatekeeper estricto",
  "Directo y seco",
  "Curioso analítico",
  "Impaciente, interrumpe",
  "Cordial pero distraído",
  "Defensivo del presupuesto",
  "Abierto pero indeciso",
  "Exigente con proveedores",
  "Pragmático, pide números",
  "Escéptico con llamadas frías",
  "Ocupado, pide ir al grano",
  "Sarcástico pero justo",
  "Colaborativo, busca valor",
  "Conservador, evita riesgo",
  "Competitivo, compara opciones",
  "Detallista, pide casos reales",
  "Escéptico con promesas",
  "Neutral, espera propuesta clara",
  "Impaciente con jerga",
  "Escucha activa con reservas",
  "Escéptico por mala experiencia previa",
] as const;

export const DIFFICULTY_LABEL_OPTIONS = [
  "Baja",
  "Media",
  "Intermedia-alta",
  "Difícil",
  "Muy difícil",
  "Exigente",
  "Accesible",
  "Alta resistencia",
] as const;

export const PRODUCT_SERVICE_OPTIONS = [
  "Software SaaS / plataforma",
  "Consultoría especializada",
  "Membresía o suscripción",
  "Póliza de seguro",
  "Crédito o financiamiento",
  "Equipamiento industrial",
  "Servicio de logística",
  "Capacitación corporativa",
  "Marketing y medios",
  "Infraestructura TI",
  "Mantenimiento preventivo",
  "Insumos médicos",
  "Maquinaria o refacciones",
  "Servicios legales",
  "Energía renovable",
  "Telefonía empresarial",
  "ERP / sistema administrativo",
  "Servicio de limpieza industrial",
  "Seguridad privada",
  "Automatización de procesos",
  "Servicio de nómina",
  "Distribución mayorista",
  "Publicidad digital",
  "Servicio de cobranza",
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];
export type TemperamentOption = (typeof TEMPERAMENT_OPTIONS)[number];
export type DifficultyLabelOption = (typeof DIFFICULTY_LABEL_OPTIONS)[number];
export type ProductServiceOption = (typeof PRODUCT_SERVICE_OPTIONS)[number];

export function isListedOption(
  value: string,
  options: readonly string[],
): boolean {
  return options.includes(value.trim());
}

export function isSelectWithOtherPending(value: string): boolean {
  return value.trim() === OTHER_OPTION_VALUE;
}

export function normalizeSelectWithOtherStoredValue(value: string): string {
  const trimmed = value.trim();
  return trimmed === OTHER_OPTION_VALUE ? "" : trimmed;
}

export function resolveSelectWithOtherValue(
  value: string,
  options: readonly string[],
): { selectValue: string; customValue: string; showOtherInput: boolean } {
  if (value === OTHER_OPTION_VALUE) {
    return {
      selectValue: OTHER_OPTION_VALUE,
      customValue: "",
      showOtherInput: true,
    };
  }
  if (value === "") {
    return { selectValue: "", customValue: "", showOtherInput: false };
  }

  const trimmed = value.trim();
  if (trimmed === OTHER_OPTION_VALUE) {
    return {
      selectValue: OTHER_OPTION_VALUE,
      customValue: "",
      showOtherInput: true,
    };
  }

  if (options.includes(trimmed) && value === trimmed) {
    return { selectValue: trimmed, customValue: "", showOtherInput: false };
  }

  return {
    selectValue: OTHER_OPTION_VALUE,
    customValue: value,
    showOtherInput: true,
  };
}
