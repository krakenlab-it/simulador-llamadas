/**
 * Demo agent profile + CV heuristics (browser). Production: API + document AI.
 */

export interface AgentProfile {
  firstName: string;
  lastName: string;
  age: number | null;
  email: string;
  phone: string;
  cvFileName?: string | null;
  cvUploadedAt?: string | null;
}

export const EMPTY_AGENT_PROFILE: AgentProfile = {
  firstName: "",
  lastName: "",
  age: null,
  email: "",
  phone: "",
  cvFileName: null,
  cvUploadedAt: null,
};

const CV_TEXT_PREFIX = "simulador.agentCv:";

export function displayNameFromProfile(
  profile: Pick<AgentProfile, "firstName" | "lastName">,
  fallback = "Agente",
): string {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function normalizeAgentProfile(
  partial: Partial<AgentProfile> & { email: string },
): AgentProfile {
  const ageRaw = partial.age;
  const age =
    typeof ageRaw === "number" && ageRaw > 0 && ageRaw < 120
      ? Math.round(ageRaw)
      : null;
  return {
    firstName: partial.firstName?.trim() ?? "",
    lastName: partial.lastName?.trim() ?? "",
    age,
    email: partial.email.trim().toLowerCase(),
    phone: partial.phone?.trim() ?? "",
    cvFileName: partial.cvFileName ?? null,
    cvUploadedAt: partial.cvUploadedAt ?? null,
  };
}

export interface CvParseResult {
  firstName?: string;
  lastName?: string;
  age?: number | null;
  email?: string;
  phone?: string;
}

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE =
  /(?:\+?52\s?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/;
const AGE_LABEL_RE = /\b(?:edad|age)\s*[:.]?\s*(\d{2})\b/i;
const NAME_LABEL_RE =
  /\b(?:nombre|name)\s*[:.]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,3})/i;

function splitPersonName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function nameFromFirstLines(text: string): { firstName: string; lastName: string } | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && line.length < 80);
  for (const line of lines.slice(0, 8)) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (/^(curriculum|cv|resume|experiencia|education)/i.test(line)) continue;
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}$/.test(line)) {
      return splitPersonName(line);
    }
  }
  return null;
}

/** Heuristic parse — same style as lightweight participante CV imports. */
export function parseCvFieldsFromText(text: string): CvParseResult {
  const normalized = text.replace(/\u0000/g, " ").slice(0, 50_000);
  const result: CvParseResult = {};

  const email = normalized.match(EMAIL_RE)?.[0];
  if (email) result.email = email.toLowerCase();

  const phone = normalized.match(PHONE_RE)?.[0];
  if (phone) result.phone = phone.replace(/\s+/g, " ").trim();

  const ageMatch = normalized.match(AGE_LABEL_RE);
  if (ageMatch) {
    result.age = Number(ageMatch[1]);
  } else {
    const birthYear = normalized.match(/\b(?:19|20)\d{2}\b/);
    if (birthYear) {
      const years = new Date().getFullYear() - Number(birthYear[0]);
      if (years > 15 && years < 80) result.age = years;
    }
  }

  const labeled = normalized.match(NAME_LABEL_RE);
  if (labeled) {
    Object.assign(result, splitPersonName(labeled[1]));
  } else {
    const fromLine = nameFromFirstLines(normalized);
    if (fromLine) Object.assign(result, fromLine);
  }

  return result;
}

export async function extractTextFromCvFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    file.type === "text/plain"
  ) {
    return await file.text();
  }

  const buf = await file.arrayBuffer();
  const latin = new TextDecoder("latin1").decode(buf);
  const runs = latin.match(/[\x20-\x7E\u00C0-\u024F]{5,}/g);
  if (runs?.length) {
    return runs.join("\n");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 8000);
}

export function storeAgentCvExtract(email: string, text: string): void {
  if (typeof window === "undefined") return;
  const key = `${CV_TEXT_PREFIX}${email.trim().toLowerCase()}`;
  window.localStorage.setItem(key, text.slice(0, 12_000));
}

export function readAgentCvExtract(email: string): string | null {
  if (typeof window === "undefined") return null;
  const key = `${CV_TEXT_PREFIX}${email.trim().toLowerCase()}`;
  return window.localStorage.getItem(key);
}

export function applyCvParseToProfile(
  current: AgentProfile,
  parsed: CvParseResult,
): AgentProfile {
  const next = { ...current };
  if (parsed.firstName && !next.firstName) next.firstName = parsed.firstName;
  if (parsed.lastName && !next.lastName) next.lastName = parsed.lastName;
  if (parsed.email && !next.email) next.email = parsed.email.toLowerCase();
  if (parsed.phone && !next.phone) next.phone = parsed.phone;
  if (parsed.age != null && next.age == null) next.age = parsed.age;
  return next;
}
