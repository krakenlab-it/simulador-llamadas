import type { PasanteProfile } from "./types";

export interface ParsedCvFields {
  fullName?: string;
  age?: number;
  city?: string;
  phone?: string;
  email?: string;
  simulationCities?: string[];
}

export interface CvExtractResult {
  text: string;
  limited?: boolean;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN =
  /(?:\+52[\s-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{10}\b/;
const AGE_LABEL_PATTERN = /(?:edad|age)\s*[:\-]?\s*(\d{2})/i;
const CITY_LABEL_PATTERN =
  /(?:ciudad|city|ubicaci[oó]n|residencia|domicilio)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúñ\s,.-]{3,40})/i;
const NAME_LINE_PATTERN =
  /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+|del\s+|la\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4}$/;

const MX_CITIES = [
  "Ciudad de México",
  "CDMX",
  "Guadalajara",
  "Monterrey",
  "Puebla",
  "Querétaro",
  "Tijuana",
  "León",
  "Mérida",
  "Cancún",
  "Aguascalientes",
  "Saltillo",
  "Hermosillo",
  "Chihuahua",
  "Toluca",
];

const SKIP_NAME_KEYWORDS =
  /^(curriculum|cv|resume|hoja|perfil|experiencia|contacto|datos|objetivo|summary)/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractEmail(text: string): string | undefined {
  return text.match(EMAIL_PATTERN)?.[0]?.toLowerCase();
}

function extractPhone(text: string): string | undefined {
  const patterns = [
    /\+52[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{4}/,
    /\+52[\s-]?\d{10}/,
    /\(?\d{2,3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
    /\b\d{10}\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/\s+/g, " ").trim();
  }

  return undefined;
}

function extractAge(text: string): number | undefined {
  const labeled = text.match(AGE_LABEL_PATTERN);
  if (labeled) {
    const age = Number(labeled[1]);
    if (age >= 16 && age <= 80) return age;
  }

  const birthYear = text.match(/(?:nacimiento|born|naci[oó] en).*?(19|20)\d{2}/i);
  if (birthYear) {
    const yearMatch = birthYear[0].match(/(19|20)\d{2}/);
    if (yearMatch) {
      const age = new Date().getFullYear() - Number(yearMatch[0]);
      if (age >= 16 && age <= 80) return age;
    }
  }

  return undefined;
}

function extractName(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 8)) {
    if (SKIP_NAME_KEYWORDS.test(line)) continue;
    if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) continue;
    if (line.length < 5 || line.length > 60) continue;
    if (NAME_LINE_PATTERN.test(line)) return line;
  }

  return undefined;
}

function findCityInText(text: string): string | undefined {
  for (const city of MX_CITIES) {
    if (text.toLowerCase().includes(city.toLowerCase())) return city;
  }

  const labeled = text.match(CITY_LABEL_PATTERN);
  if (labeled) {
    const city = labeled[1].split(/[,|\n]/)[0]?.trim();
    if (city && city.length >= 3) return city;
  }

  return undefined;
}

function extractSimulationCities(text: string, residence?: string): string[] {
  const found = MX_CITIES.filter((city) =>
    text.toLowerCase().includes(city.toLowerCase()),
  );
  const residenceKey = residence?.toLowerCase();
  return [...new Set(found.filter((city) => city.toLowerCase() !== residenceKey))].slice(
    0,
    5,
  );
}

export function parseCvText(text: string): ParsedCvFields {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return {};

  const email = extractEmail(normalized);
  const phone = extractPhone(normalized);
  const fullName = extractName(normalized);
  const age = extractAge(normalized);
  const city = findCityInText(normalized);
  const simulationCities = extractSimulationCities(normalized, city);

  return {
    ...(fullName ? { fullName } : {}),
    ...(typeof age === "number" ? { age } : {}),
    ...(city ? { city } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(simulationCities.length > 0 ? { simulationCities } : {}),
  };
}

export function applyParsedCvToProfile(
  profile: PasanteProfile,
  parsed: ParsedCvFields,
  cvFileName?: string,
): PasanteProfile {
  return {
    ...profile,
    fullName: parsed.fullName ?? profile.fullName,
    age: parsed.age ?? profile.age,
    city: parsed.city ?? profile.city,
    phone: parsed.phone ?? profile.phone,
    email: parsed.email ?? profile.email,
    simulationCities:
      parsed.simulationCities && parsed.simulationCities.length > 0
        ? parsed.simulationCities
        : profile.simulationCities,
    cvFileName: cvFileName ?? profile.cvFileName,
  };
}

function extractNaivePdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (const byte of bytes) {
    raw += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : " ";
  }

  const chunks: string[] = [];
  const parenMatches = raw.match(/\((?:\\.|[^\\)]){2,120}\)/g) ?? [];
  for (const match of parenMatches) {
    const inner = match
      .slice(1, -1)
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")");
    if (/[a-zA-Z@0-9]/.test(inner)) chunks.push(inner);
  }

  return normalizeWhitespace(chunks.join(" "));
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return normalizeWhitespace(result.value);
}

export async function extractTextFromCvFile(
  file: Pick<File, "name" | "text" | "arrayBuffer">,
): Promise<CvExtractResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "txt" || extension === "md") {
    return { text: normalizeWhitespace(await file.text()) };
  }

  if (extension === "docx") {
    try {
      const text = await extractDocxText(await file.arrayBuffer());
      return { text, limited: !text };
    } catch {
      return { text: "", limited: true };
    }
  }

  if (extension === "pdf") {
    try {
      const text = extractNaivePdfText(await file.arrayBuffer());
      return { text, limited: !text };
    } catch {
      return { text: "", limited: true };
    }
  }

  throw new Error("Formato no soportado. Usa .txt, .md, .pdf o .docx.");
}

export async function parseCvFile(
  file: Pick<File, "name" | "text" | "arrayBuffer">,
): Promise<{ parsed: ParsedCvFields; limited: boolean; text: string }> {
  const extracted = await extractTextFromCvFile(file);
  const parsed = parseCvText(extracted.text);
  return {
    parsed,
    limited: Boolean(extracted.limited) || !extracted.text,
    text: extracted.text,
  };
}
