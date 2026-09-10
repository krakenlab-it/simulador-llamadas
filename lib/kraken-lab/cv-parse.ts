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

export interface ParseCvFileResult {
  parsed: ParsedCvFields;
  limited: boolean;
  text: string;
  nameFromFileName?: boolean;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN =
  /(?:\+52[\s-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{10}\b/;
const AGE_LABEL_PATTERN = /(?:edad|age)\s*[:\-]?\s*(\d{2})/i;
const ANOS_PATTERN = /\b(\d{2})\s*a(?:ñ|n)os\b/i;
const YEARS_OLD_PATTERN = /\b(\d{2})\s*years?\s*old\b/i;
const DOB_PATTERN = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-]((19|20)\d{2})\b/;
const CITY_LABEL_PATTERN =
  /(?:ciudad|city|ubicaci[oó]n|residencia|domicilio)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúñ\s,.-]{3,40})/i;

const NAME_PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);
const FILENAME_CV_MARKERS =
  /\b(?:cv|curriculum(?:\s*vitae)?|resume|r[eé]sum[eé]|hoja\s*de\s*vida)\b/gi;

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

function titleCaseToken(token: string): string {
  if (NAME_PARTICLES.has(token.toLowerCase())) return token.toLowerCase();
  if (/^[A-ZÁÉÍÓÚÑ]+$/.test(token) && token.length > 1) {
    return token.charAt(0) + token.slice(1).toLowerCase();
  }
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function titleCaseName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

function isBlankString(value: string | undefined): boolean {
  return !value?.trim();
}

function isBlankAge(age: number | undefined): boolean {
  return age === undefined || age === 0;
}

function isValidAge(age: number): boolean {
  return age >= 16 && age <= 80;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isLikelyYyyyMmDdPhoneGarbage(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8 && digits.length !== 10) return false;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (year < 2000) return false;
  return isValidCalendarDate(year, month, day);
}

function sanitizeExtractedPhone(value: string | undefined): string | undefined {
  if (!value || isLikelyYyyyMmDdPhoneGarbage(value)) return undefined;
  return value;
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
    if (match) {
      const candidate = match[0].replace(/\s+/g, " ").trim();
      const sanitized = sanitizeExtractedPhone(candidate);
      if (sanitized) return sanitized;
    }
  }

  return undefined;
}

function ageFromBirthDate(day: number, month: number, year: number): number | undefined {
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  const dayDiff = today.getDate() - day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return isValidAge(age) ? age : undefined;
}

function extractAge(text: string): number | undefined {
  const labeled = text.match(AGE_LABEL_PATTERN);
  if (labeled) {
    const age = Number(labeled[1]);
    if (isValidAge(age)) return age;
  }

  const anos = text.match(ANOS_PATTERN);
  if (anos) {
    const age = Number(anos[1]);
    if (isValidAge(age)) return age;
  }

  const yearsOld = text.match(YEARS_OLD_PATTERN);
  if (yearsOld) {
    const age = Number(yearsOld[1]);
    if (isValidAge(age)) return age;
  }

  const dob = text.match(DOB_PATTERN);
  if (dob) {
    const age = ageFromBirthDate(Number(dob[1]), Number(dob[2]), Number(dob[3]));
    if (age !== undefined) return age;
  }

  const birthYear = text.match(/(?:nacimiento|born|naci[oó] en|fecha de nacimiento).*?(19|20)\d{2}/i);
  if (birthYear) {
    const yearMatch = birthYear[0].match(/(19|20)\d{2}/);
    if (yearMatch) {
      const age = new Date().getFullYear() - Number(yearMatch[0]);
      if (isValidAge(age)) return age;
    }
  }

  return undefined;
}

function isNameToken(token: string): boolean {
  if (NAME_PARTICLES.has(token.toLowerCase())) return true;
  return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$|^[A-ZÁÉÍÓÚÑ]{2,}$/.test(token);
}

function looksLikeNameLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;
  return tokens.every(isNameToken);
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
    if (looksLikeNameLine(line)) {
      return titleCaseName(line);
    }
  }

  return undefined;
}

export function extractNameFromFileName(fileName: string): string | undefined {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(FILENAME_CV_MARKERS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 5 || cleaned.length > 80) return undefined;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return undefined;
  if (!tokens.every((token) => /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+$/.test(token))) return undefined;

  return titleCaseName(tokens.join(" "));
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

function resolveAgeAfterCvParse(profile: PasanteProfile, parsed: ParsedCvFields): number {
  if (parsed.age !== undefined && isValidAge(parsed.age)) {
    return parsed.age;
  }
  if (!isBlankAge(profile.age) && isValidAge(profile.age)) {
    return profile.age;
  }
  return 0;
}

export function applyParsedCvToProfile(
  profile: PasanteProfile,
  parsed: ParsedCvFields,
  cvFileName?: string,
): PasanteProfile {
  return {
    ...profile,
    fullName: !isBlankString(profile.fullName)
      ? profile.fullName
      : !isBlankString(parsed.fullName)
        ? parsed.fullName!
        : profile.fullName,
    age: resolveAgeAfterCvParse(profile, parsed),
    city: !isBlankString(profile.city)
      ? profile.city
      : !isBlankString(parsed.city)
        ? parsed.city!
        : profile.city,
    phone: !isBlankString(profile.phone)
      ? profile.phone
      : !isBlankString(parsed.phone)
        ? parsed.phone!
        : profile.phone,
    email: !isBlankString(profile.email)
      ? profile.email
      : !isBlankString(parsed.email)
        ? parsed.email!
        : profile.email,
    simulationCities:
      profile.simulationCities.length > 0
        ? profile.simulationCities
        : parsed.simulationCities && parsed.simulationCities.length > 0
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

async function extractPdfTextWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return normalizeWhitespace(pages.join("\n"));
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
    const buffer = await file.arrayBuffer();

    if (typeof window !== "undefined") {
      try {
        const pdfText = await extractPdfTextWithPdfJs(buffer);
        if (pdfText) return { text: pdfText };
      } catch {
        // Fall through to naive extraction.
      }
    }

    try {
      const text = extractNaivePdfText(buffer);
      return { text, limited: !text };
    } catch {
      return { text: "", limited: true };
    }
  }

  throw new Error("Formato no soportado. Usa .txt, .md, .pdf o .docx.");
}

export async function parseCvFile(
  file: Pick<File, "name" | "text" | "arrayBuffer">,
): Promise<ParseCvFileResult> {
  const extracted = await extractTextFromCvFile(file);
  const parsedFromText = parseCvText(extracted.text);
  let parsed = parsedFromText;
  let nameFromFileName = false;

  if (!parsed.fullName) {
    const fromFileName = extractNameFromFileName(file.name);
    if (fromFileName) {
      parsed = { ...parsed, fullName: fromFileName };
      nameFromFileName = true;
    }
  }

  return {
    parsed,
    limited: Boolean(extracted.limited) || !extracted.text,
    text: extracted.text,
    nameFromFileName,
  };
}
