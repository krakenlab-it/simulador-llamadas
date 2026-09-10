import { fullScenarioContextText } from "./scenario-context";
import type { ScenarioContextUpload } from "./types";

export interface ParsedStructuredBrief {
  cliente?: string;
  industria?: string;
  producto?: string;
  problema?: string;
  objeciones?: string;
  criterio?: string;
  extraLines: string[];
}

const FIELD_PREFIXES: Array<{
  key: Exclude<keyof ParsedStructuredBrief, "extraLines">;
  prefix: string;
}> = [
  { key: "cliente", prefix: "Cliente:" },
  { key: "industria", prefix: "Industria:" },
  { key: "producto", prefix: "Producto/servicio:" },
  { key: "problema", prefix: "Problema:" },
  { key: "objeciones", prefix: "Objeciones:" },
  { key: "criterio", prefix: "Criterio de éxito:" },
];

export function parseStructuredBrief(text: string): ParsedStructuredBrief {
  const parsed: ParsedStructuredBrief = { extraLines: [] };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = FIELD_PREFIXES.find(({ prefix }) =>
      trimmed.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    if (match) {
      parsed[match.key] = trimmed.slice(match.prefix.length).trim();
      continue;
    }

    parsed.extraLines.push(trimmed);
  }

  return parsed;
}

const INDUSTRY_PROBLEM_TEMPLATES: Record<string, string> = {
  "Banca y servicios financieros":
    "Originación y seguimiento manual retrasan cierres, elevan riesgo operativo y frustran a clientes corporativos.",
  Seguros:
    "Renovaciones y siniestros se traban entre canales; falta visibilidad del pipeline y se pierden primas recuperables.",
  "Retail y tiendas departamentales":
    "Inventario desalineado con demanda genera quiebres de stock, mermas y promociones mal ejecutadas en piso.",
  "SaaS B2B":
    "Equipos de ventas y CS operan en hojas sueltas; no hay una sola vista del pipeline ni adopción post-venta.",
  Farmacéuticas:
    "Distribución y cumplimiento regulatorio se complican cuando ventas y logística no comparten el mismo dato.",
  "Automotriz y refacciones":
    "Refacciones urgentes se pierden entre taller, almacén y proveedor; aumentan tiempos muertos y reclamos.",
  "Vivienda y desarrollo inmobiliario":
    "Leads y apartados se enfrían por seguimiento lento entre brokers, legal y cobranza.",
  "Educación privada":
    "Inscripciones y cobranza escolar compiten con procesos manuales que retrasan cierres de ciclo.",
  "Hospitalidad y hoteles":
    "Ocupación y upsell dependen de coordinación manual entre recepción, revenue y operaciones.",
  "Logística y transporte":
    "Entregas urgentes se atascan por falta de visibilidad entre ventas, tráfico y almacén.",
  "Alimentos y bebidas":
    "Pedidos y mermas se disparan cuando rutas, inventario y ventas no hablan el mismo idioma.",
  Telecomunicaciones:
    "Activaciones y portabilidades se retrasan por procesos desconectados entre ventas, técnica y cobranza.",
  "Energía y utilities":
    "Contratos y consumos corporativos se gestionan con datos tardíos; cuesta detectar fugas y oportunidades.",
  Agroindustria:
    "Cosecha y comercialización se desincronizan; ventas promete lo que almacén y campo no pueden cumplir.",
  "Clínicas y salud privada":
    "Agenda, autorizaciones y cobranza se estancan en llamadas y papeles; pacientes esperan demasiado.",
  "Gimnasios y wellness":
    "Renovaciones y leads se enfrían por seguimiento manual entre recepción, ventas y entrenadores.",
  "Belleza y estética":
    "Citas y recompra dependen de recordatorios manuales; se pierden upsells por falta de seguimiento.",
  "Construcción e infraestructura":
    "Avance de obra y compras urgentes chocan cuando ventas, compras y obra no comparten prioridades.",
  "Servicios profesionales":
    "Propuestas y entregables se retrasan por falta de visibilidad entre ventas, operaciones y facturación.",
  "E-commerce y marketplaces":
    "Picos de demanda saturan almacén y atención; promesas de entrega se rompen por mala coordinación.",
  Manufactura:
    "Pedidos urgentes chocan con producción y almacén; ventas promete fechas que planta no ve a tiempo.",
  "Importación y distribución":
    "Pedidos urgentes se atascan entre ventas y almacén; pierden entregas por falta de visibilidad del pipeline comercial.",
  "Tecnología industrial":
    "Mantenimiento y repuestos críticos se demoran por procesos manuales entre ventas, almacén y planta.",
  "Medios y publicidad":
    "Campañas y pauta se ejecutan tarde porque ventas, creativos y tráfico no comparten un solo tablero.",
  "Minería y recursos naturales":
    "Compras críticas y seguridad operativa se complican cuando proveedores y almacén no están alineados.",
  "Textil y confección":
    "Temporadas y pedidos urgentes se pierden entre diseño, producción y distribución.",
  "Turismo y viajes":
    "Reservas grupales y cambios de última hora saturan ventas y operaciones sin un flujo único.",
  "Legal y compliance":
    "Contratos y vencimientos se escapan cuando ventas, legal y operaciones trabajan en silos.",
  "Call center y BPO":
    "Rotación y calidad caen cuando capacitación, operaciones y ventas no comparten indicadores en tiempo real.",
  "Cooperativas y sector social":
    "Socios y beneficiarios esperan respuestas lentas porque ventas, operaciones y cobranza no están conectadas.",
};

function extractProductHint(existingText: string, fileTexts: string[]): string | undefined {
  const parsed = parseStructuredBrief(existingText);
  if (parsed.producto?.trim()) return parsed.producto.trim();

  const blob = fileTexts.join("\n").toLowerCase();
  const productPatterns = [
    /kraken flow/i,
    /producto[s]?\s*:\s*([^\n.]{3,80})/i,
    /servicio[s]?\s*:\s*([^\n.]{3,80})/i,
    /vendemos\s+([^.\n]{3,80})/i,
  ];

  for (const pattern of productPatterns) {
    const match = blob.match(pattern);
    if (match) {
      return (match[1] ?? match[0]).trim();
    }
  }

  return undefined;
}

function extractDocProblemSentence(fileTexts: string[]): string | undefined {
  const blob = fileTexts.join("\n");
  const sentences = blob
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40);

  const problemKeywords =
    /(?:problema|dolor|atasc|retras|pierd|falt|urgent|objeci|ERP|pipeline|visibilidad|manual)/i;

  return sentences.find((sentence) => problemKeywords.test(sentence));
}

function buildProblemForIndustry(
  industry: string,
  productHint: string | undefined,
  fileTexts: string[],
  existingProblem?: string,
): string {
  const docSentence = extractDocProblemSentence(fileTexts);
  if (docSentence && docSentence.length >= 40) {
    return docSentence.endsWith(".") ? docSentence : `${docSentence}.`;
  }

  const template =
    INDUSTRY_PROBLEM_TEMPLATES[industry] ??
    `En ${industry.toLowerCase()}, ventas y operaciones no comparten visibilidad; los pedidos urgentes se atascan y se pierden oportunidades.`;

  if (productHint && !template.toLowerCase().includes(productHint.toLowerCase().slice(0, 12))) {
    return `${template.replace(/\.$/, "")}; el reto se agrava al escalar ${productHint}.`;
  }

  if (existingProblem?.trim() && existingProblem.trim().length > 40) {
    return existingProblem.trim();
  }

  return template;
}

export function buildClientProblemForIndustry(
  industry: string,
  productHint?: string,
): string {
  const trimmedIndustry = industry.trim();
  if (!trimmedIndustry) return "";
  return buildProblemForIndustry(
    trimmedIndustry,
    productHint?.trim() || undefined,
    [],
    undefined,
  );
}

export function isIndustryDefaultClientProblem(problem: string, industry: string): boolean {
  const trimmedProblem = problem.trim();
  const trimmedIndustry = industry.trim();

  if (!trimmedProblem) return true;
  if (!trimmedIndustry) return false;

  const template = INDUSTRY_PROBLEM_TEMPLATES[trimmedIndustry];
  if (template) {
    if (trimmedProblem === template) return true;
    if (trimmedProblem.startsWith(template.replace(/\.$/, ""))) return true;
  }

  const generic = `En ${trimmedIndustry.toLowerCase()}, ventas y operaciones no comparten visibilidad; los pedidos urgentes se atascan y se pierden oportunidades.`;
  return trimmedProblem === generic || trimmedProblem.startsWith(generic.replace(/\.$/, ""));
}

export function shouldConfirmIndustryBriefOverwrite(existingText: string): boolean {
  const parsed = parseStructuredBrief(existingText);
  return (parsed.problema?.trim().length ?? 0) > 100;
}

export function buildIndustryAwareBrief(input: {
  industry: string;
  existingText?: string;
  fileTexts?: string[];
  productHint?: string;
}): string {
  const existingText = input.existingText?.trim() ?? "";
  const parsed = parseStructuredBrief(existingText);
  const fileTexts = input.fileTexts ?? [];
  const productHint =
    input.productHint ?? extractProductHint(existingText, fileTexts) ?? parsed.producto;

  const lines: string[] = [];

  if (parsed.cliente?.trim()) {
    lines.push(`Cliente: ${parsed.cliente.trim()}`);
  }

  lines.push(`Industria: ${input.industry.trim()}`);

  if (productHint?.trim()) {
    lines.push(`Producto/servicio: ${productHint.trim()}`);
  }

  lines.push(
    `Problema: ${buildProblemForIndustry(
      input.industry,
      productHint,
      fileTexts,
      parsed.problema,
    )}`,
  );

  if (parsed.objeciones?.trim()) {
    lines.push(`Objeciones: ${parsed.objeciones.trim()}`);
  }
  if (parsed.criterio?.trim()) {
    lines.push(`Criterio de éxito: ${parsed.criterio.trim()}`);
  }

  if (parsed.extraLines.length > 0) {
    lines.push(...parsed.extraLines);
  }

  return lines.join("\n").trim();
}

export function inferContextIndustryFromBrief(text: string): string | undefined {
  const parsed = parseStructuredBrief(text);
  return parsed.industria?.trim() || undefined;
}

export function mergeScenarioContextUpload(
  incoming: ScenarioContextUpload | undefined,
  stored: ScenarioContextUpload | undefined,
): ScenarioContextUpload {
  const inc = incoming ?? { text: "" };
  const st = stored ?? { text: "" };
  const incFiles = inc.files ?? [];
  const stFiles = st.files ?? [];

  const incText = inc.text?.trim() ?? "";
  const stText = st.text?.trim() ?? "";
  const text =
    incText.length >= 30 || stText.length <= incText.length
      ? inc.text ?? ""
      : st.text ?? inc.text ?? "";

  const files = incFiles.length > 0 ? incFiles : stFiles;

  return {
    text,
    ...(files.length > 0 ? { files } : {}),
    fileName: inc.fileName ?? st.fileName,
    uploadedAt: inc.uploadedAt ?? st.uploadedAt,
  };
}

export function scenarioContextHasSavedFiles(
  context: ScenarioContextUpload | undefined,
): boolean {
  return (context?.files?.length ?? 0) > 0;
}

export function countScenarioContextFiles(context: ScenarioContextUpload | undefined): number {
  return context?.files?.length ?? 0;
}

export function savedFilesBannerMessage(fileCount: number): string {
  return `Ya tienes ${fileCount} archivo(s) guardado(s) para este proyecto. ¿Quieres agregar o borrar alguno?`;
}

export { fullScenarioContextText };
