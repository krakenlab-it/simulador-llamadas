export const CLINIC_BLOCKED_FULL_NAMES = new Set([
  "mariana escobedo",
  "rodrigo nava",
  "efraín loera",
  "efrain loera",
]);

export const CLINIC_BLOCKED_FIRST_NAMES = new Set([
  "mariana",
  "rodrigo",
  "efraín",
  "efrain",
]);

export const CLINIC_BLOCKED_LAST_NAMES = new Set(["escobedo", "nava", "loera"]);

export const FEMALE_FIRST_NAMES = [
  "Valeria",
  "Lucía",
  "Camila",
  "Daniela",
  "Sofía",
  "Andrea",
  "Paola",
  "Renata",
  "Gabriela",
  "Fernanda",
  "Alejandra",
  "Diana",
  "Patricia",
  "Verónica",
  "Claudia",
  "Montserrat",
  "Regina",
  "Ximena",
  "Iliana",
  "Marisol",
] as const;

export const MALE_FIRST_NAMES = [
  "Carlos",
  "Eduardo",
  "Fernando",
  "Héctor",
  "Javier",
  "Miguel",
  "Raúl",
  "Arturo",
  "Gerardo",
  "Iván",
  "Leonardo",
  "Mateo",
  "Oscar",
  "Pablo",
  "Ricardo",
  "Sergio",
  "Tomás",
  "Ulises",
  "Víctor",
  "Alonso",
] as const;

export const LAST_NAMES = [
  "Mendoza",
  "Vargas",
  "Herrera",
  "Castillo",
  "Ríos",
  "Soto",
  "Delgado",
  "Fuentes",
  "Aguilar",
  "Morales",
  "Ibarra",
  "Salinas",
  "Paredes",
  "Zavala",
  "Cervantes",
  "Montoya",
  "Quintero",
  "Bustamante",
  "Velasco",
  "Arriaga",
  "Carrillo",
  "Espinoza",
  "Galván",
  "Lozano",
] as const;

export const RECEIVER_ROLES = [
  "Directora de compras",
  "Gerente de operaciones",
  "Dueño de PYME",
  "Coordinador de logística",
  "Jefa de mantenimiento",
  "Administrador general",
  "Director comercial",
  "Gerente de sucursal",
  "Director de TI",
  "Jefe de almacén",
  "Gerente de marketing",
  "Director financiero",
] as const;

export const RECEIVER_INDUSTRIES = [
  "Manufactura",
  "Retail",
  "Servicios profesionales",
  "Alimentos y bebidas",
  "Tecnología B2B",
  "Construcción",
  "Salud privada",
  "Logística",
  "Automotriz",
  "Importación y distribución",
  "Telecomunicaciones",
  "Energía",
  "Educación corporativa",
  "Hospitalidad",
  "Agroindustria",
] as const;

export const KPI_TEMPLATES = [
  "Indicador: Costo por lead calificado",
  "Indicador: Tiempo de respuesta a clientes",
  "Indicador: Rotación de inventario",
  "Indicador: Margen por pedido",
  "Indicador: Visitas comerciales efectivas",
  "Indicador: Tasa de conversión en sucursal",
  "Indicador: Días de cobranza",
  "Indicador: Productividad por turno",
  "Indicador: Retención de clientes",
  "Indicador: Cumplimiento de entregas",
  "Indicador: Costo logístico por envío",
  "Indicador: Horas-hombre en retrabajo",
] as const;

export const PAIN_TEMPLATES = [
  "Presupuesto apretado este trimestre",
  "Ya probó soluciones similares sin resultado",
  "Equipo saturado y sin tiempo para evaluar",
  "Necesita ver ROI antes de moverse",
  "Proveedor actual renovó hace poco",
  "Procesos manuales que generan errores",
  "Pérdida de oportunidades por seguimiento lento",
  "Datos dispersos entre sucursales",
  "Resistencia del equipo al cambio",
  "Presión del corporativo por reducir costos",
  "Falta de visibilidad en operación diaria",
  "Clientes insatisfechos por tiempos de respuesta",
] as const;

export const DIFFICULTY_LABELS = [
  "Baja",
  "Media",
  "Intermedia-alta",
  "Difícil",
  "Muy difícil",
] as const;

export const TEMPERAMENT_BY_DIFFICULTY = {
  1: [
    "Amable pero cauteloso",
    "Curioso analítico",
    "Cordial pero distraído",
    "Neutral, espera propuesta clara",
  ],
  2: [
    "Escéptico, poco tiempo",
    "Directo y seco",
    "Pragmático, pide números",
    "Ocupado, pide ir al grano",
  ],
  3: [
    "Gatekeeper estricto",
    "Impaciente, interrumpe",
    "Escéptico con llamadas frías",
    "Defensivo del presupuesto",
  ],
} as const;

export function isBlockedPersonaName(fullName: string): boolean {
  const normalized = fullName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (CLINIC_BLOCKED_FULL_NAMES.has(normalized)) return true;

  const [first, ...rest] = normalized.split(/\s+/);
  const last = rest.join(" ");
  if (CLINIC_BLOCKED_FIRST_NAMES.has(first)) return true;
  if (CLINIC_BLOCKED_LAST_NAMES.has(last)) return true;
  return false;
}
