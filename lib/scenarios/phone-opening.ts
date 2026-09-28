import type { ScenarioLanguage } from "./types";

export interface PhoneOpeningContext {
  clientName?: string;
  companyContext?: string;
  industry?: string;
  language?: ScenarioLanguage;
}

const MX_CITY_HINTS: Array<{ pattern: RegExp; greeting: string }> = [
  { pattern: /\bmonterrey\b/i, greeting: "Buenas tardes, ¿dígame?" },
  { pattern: /\bgdl\b|guadalajara/i, greeting: "Buenas tardes, ¿con quién hablo?" },
  { pattern: /\bcdmx\b|ciudad de méxico|cd\.?\s*méxico|df\b/i, greeting: "Buenos días, ¿sí?" },
  { pattern: /\bquerétaro\b/i, greeting: "Buenas tardes, ¿sí?" },
  { pattern: /\bpuebla\b/i, greeting: "Buenas tardes, ¿dígame?" },
  { pattern: /\btijuana\b/i, greeting: "Buenas tardes, ¿quién habla?" },
  { pattern: /\bleón\b|leon\b/i, greeting: "Buenas tardes, ¿con quién hablo?" },
  { pattern: /\bmerida\b|mérida\b/i, greeting: "Buenas tardes, ¿sí?" },
];

const US_CITY_HINTS: Array<{ pattern: RegExp; greeting: string }> = [
  { pattern: /\bnew york\b|nyc\b/i, greeting: "Hello, who's calling?" },
  { pattern: /\bmiami\b/i, greeting: "Hello, this is busy — who's this?" },
  { pattern: /\bhouston\b|dallas\b|austin\b/i, greeting: "Hello, who's calling?" },
];

function inferRegionalGreeting(
  haystack: string,
  language: ScenarioLanguage,
): string | null {
  const hints = language === "en" ? US_CITY_HINTS : MX_CITY_HINTS;
  for (const hint of hints) {
    if (hint.pattern.test(haystack)) return hint.greeting;
  }
  if (/\bméxico\b|mexico\b|\bmx\b/i.test(haystack) && language === "es") {
    return "Buenas tardes, ¿con quién hablo?";
  }
  if (/\b(spain|españa|madrid|barcelona)\b/i.test(haystack) && language === "es") {
    return "Buenas tardes, ¿dígame?";
  }
  if (/\b(usa|united states|america)\b/i.test(haystack) && language === "en") {
    return "Hello, who's calling?";
  }
  return null;
}

function timeOfDayGreeting(language: ScenarioLanguage): string {
  const hour = new Date().getUTCHours() - 6; // rough Mexico City offset for variety
  const normalized = ((hour % 24) + 24) % 24;
  if (language === "en") {
    if (normalized < 12) return "Good morning, who's calling?";
    if (normalized < 19) return "Good afternoon, who's this?";
    return "Hello, who's calling?";
  }
  if (normalized < 12) return "Buenos días, ¿con quién hablo?";
  if (normalized < 19) return "Buenas tardes, ¿con quién hablo?";
  return "Buenas noches, ¿sí?";
}

/**
 * Natural phone pickup — never embeds coach briefing / problema text.
 */
export function buildPhonePickupOpening(ctx: PhoneOpeningContext): string {
  const language = ctx.language ?? "es";
  const haystack = [ctx.companyContext, ctx.industry, ctx.clientName]
    .filter(Boolean)
    .join(" · ");
  const regional = inferRegionalGreeting(haystack, language);
  if (regional) return regional;
  return timeOfDayGreeting(language);
}

export function buildSecondaryPickupLine(
  clientName: string,
  language: ScenarioLanguage = "es",
): string {
  const name = clientName.trim();
  if (!name) {
    return language === "en" ? "I'm in the middle of something." : "Estoy en otra cosa.";
  }
  return language === "en"
    ? `If this is a sales pitch, I'm ${name} — make it quick.`
    : `Si es ventas, soy ${name}; sea breve.`;
}
