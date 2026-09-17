import {
  defaultDifficultyLabel,
  defaultTemperament,
  defaultWinCriteria,
  emptyAuthoringDraft,
} from "@/lib/scenarios/authoring";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";
import type { ScenarioCallType, ScenarioLanguage } from "@/lib/scenarios/types";
import { executeApplyScenario, executeProposeScenario } from "./tools";
import type {
  AgentChatMessage,
  AgentHarnessSettings,
  AgentToolSession,
  AgentToolTrace,
} from "./types";

interface ExtractedScenario {
  clientName?: string;
  clientTitle?: string;
  companyContext?: string;
  industry?: string;
  productSold?: string;
  clientProblem?: string;
  objections?: string[];
  temperament?: string;
  callType?: ScenarioCallType;
}

const INDUSTRY_HINTS: Array<{ pattern: RegExp; industry: string; product: string; title: string; company: string }> =
  [
    {
      pattern: /banc[oa]|sucursal bancaria|fintech/i,
      industry: "banca",
      product: "pauta digital y captación de cuentas",
      title: "Gerente de sucursal",
      company: "Banco regional",
    },
    {
      pattern: /gimnasio|fitness|retenci[oó]n de socios/i,
      industry: "gimnasios",
      product: "membresía anual",
      title: "Gerente de sucursal",
      company: "Cadena de gimnasios",
    },
    {
      pattern: /farmacia|retail farmac/i,
      industry: "farmacias",
      product: "medios en punto de venta",
      title: "Gerente de medios",
      company: "Cadena de farmacias",
    },
    {
      pattern: /inmobil|vivienda|desarrolladora/i,
      industry: "inmobiliaria",
      product: "medios para visitas a caseta",
      title: "Directora de mercadotecnia",
      company: "Desarrolladora de vivienda",
    },
    {
      pattern: /auto|concesionario|distribuidor/i,
      industry: "automotriz",
      product: "campaña para piso de venta",
      title: "Director comercial",
      company: "Grupo distribuidor automotriz",
    },
    {
      pattern: /seguro|p[oó]liza/i,
      industry: "seguros",
      product: "leads calificados",
      title: "Director comercial",
      company: "Aseguradora regional",
    },
    {
      pattern: /saas|software|b2b/i,
      industry: "software B2B",
      product: "plataforma de analítica",
      title: "Head of Growth",
      company: "SaaS B2B",
    },
  ];

function lastUserText(messages: AgentChatMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" \n ");
}

function wantsApply(text: string): boolean {
  return /\b(guarda|guardar|gu[aá]rdalo|apl[ií]calo|ya|listo|confirmo|ok,?\s*guarda)\b/i.test(
    text,
  );
}

function detectIndustry(text: string): (typeof INDUSTRY_HINTS)[number] | null {
  return INDUSTRY_HINTS.find((hint) => hint.pattern.test(text)) ?? null;
}

function extractName(text: string): string | undefined {
  const named = text.match(
    /(?:se llama|llamad[oa]|cliente(?: se llama)?|nombre(?: del cliente)? es)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/i,
  );
  if (named?.[1]) return named[1].trim();
  return undefined;
}

function extractProblem(text: string, industry: string | undefined): string | undefined {
  const noQuiere = text.match(
    /no quiere\s+([^.,;]+)|no le interesa\s+([^.,;]+)|rechaza\s+([^.,;]+)/i,
  );
  if (noQuiere) {
    const rejected = (noQuiere[1] ?? noQuiere[2] ?? noQuiere[3]).trim();
    return `No quiere ${rejected}`.slice(0, 160);
  }
  const duele = text.match(
    /(?:le duele|problema(?: es)?|dolor(?: es)?|reto(?: es)?)\s+([^.,;]+)/i,
  );
  if (duele?.[1]) return duele[1].trim().slice(0, 160);
  if (industry === "banca") return "No quiere invertir en pauta digital";
  return undefined;
}

function extractProduct(text: string): string | undefined {
  const sold = text.match(
    /(?:vende(?:mos)?|ofrecer|pauta de|producto(?: es)?)\s+([^.,;]+)/i,
  );
  return sold?.[1]?.trim().slice(0, 120);
}

function extractFromConversation(
  messages: AgentChatMessage[],
  settings: AgentHarnessSettings,
): ExtractedScenario {
  const text = lastUserText(messages);
  const hint = detectIndustry(text);
  const problem = extractProblem(text, hint?.industry);
  const product = extractProduct(text) ?? hint?.product;
  const name = extractName(text);

  const callType: ScenarioCallType =
    settings.presetId === "cierre" || /cierre|cerrar|agendar/i.test(text)
      ? "cierre"
      : settings.callType;

  const temperament =
    settings.presetId === "esceptico" || /esc[eé]ptic|dif[ií]cil|impacient/i.test(text)
      ? settings.language === "en"
        ? "Skeptical, short on time"
        : "Escéptico, poco tiempo"
      : undefined;

  return {
    clientName: name,
    clientTitle: hint?.title,
    companyContext: hint?.company,
    industry: hint?.industry,
    productSold: product,
    clientProblem: problem,
    objections: problem ? [problem] : undefined,
    temperament,
    callType,
  };
}

function fillDraft(
  extracted: ExtractedScenario,
  settings: AgentHarnessSettings,
  current: ScenarioAuthoringDraft | null,
): ScenarioAuthoringDraft {
  const language: ScenarioLanguage = settings.language;
  const base = current ?? emptyAuthoringDraft(language);
  const industry = extracted.industry || base.industry || "medios y publicidad";
  const product =
    extracted.productSold || base.productSold || "solución de medios medibles";
  const problem =
    extracted.clientProblem ||
    base.clientProblem ||
    (language === "en"
      ? "Cannot prove the channel moves the real KPI"
      : "No puede demostrar que el canal mueve el KPI real");

  return {
    ...base,
    language,
    callType: extracted.callType ?? settings.callType,
    clientName:
      extracted.clientName ||
      base.clientName ||
      (language === "en" ? "Alex Rivera" : "Alex Rivera"),
    clientTitle:
      extracted.clientTitle ||
      base.clientTitle ||
      (language === "en" ? "Commercial director" : "Director comercial"),
    companyContext:
      extracted.companyContext ||
      base.companyContext ||
      (language === "en" ? "Regional group" : "Grupo regional"),
    industry,
    productSold: product,
    clientProblem: problem,
    objections:
      extracted.objections && extracted.objections.length > 0
        ? extracted.objections
        : base.objections.filter(Boolean).length > 0
          ? base.objections
          : [
              language === "en" ? "Already have an agency" : "Ya tengo agencia",
              language === "en" ? "Send me an email" : "Mándeme un correo",
            ],
    temperament:
      extracted.temperament ||
      base.temperament ||
      defaultTemperament(language),
    winCriteria: base.winCriteria || defaultWinCriteria(language),
    difficultyLabel: base.difficultyLabel || defaultDifficultyLabel(language),
  };
}

function assistantCopy(
  language: ScenarioLanguage,
  draft: ScenarioAuthoringDraft,
  applied: boolean,
): string {
  if (language === "en") {
    return applied
      ? `The scenario for ${draft.clientName} is ready to save. Review it on the right, or keep chatting to tweak it.`
      : `I drafted ${draft.clientName} (${draft.clientTitle}) in ${draft.industry}. Pain: ${draft.clientProblem}. Say “save it” or edit the prompt / settings if you want a different angle.`;
  }
  return applied
    ? `El escenario de ${draft.clientName} quedó listo para guardar. Revísalo a la derecha o sigue la conversación para ajustarlo.`
    : `Armé el caso de ${draft.clientName} (${draft.clientTitle}) en ${draft.industry}. Dolor: ${draft.clientProblem}. Di «guárdalo» o edita el prompt / los ajustes si quieres otro ángulo.`;
}

export function runLocalAgentTurn(input: {
  messages: AgentChatMessage[];
  session: AgentToolSession;
}): {
  text: string;
  traces: AgentToolTrace[];
} {
  const { messages, session } = input;
  const last = messages[messages.length - 1]?.content ?? "";
  const traces: AgentToolTrace[] = [];
  const extracted = extractFromConversation(messages, session.settings);
  const filled = fillDraft(extracted, session.settings, session.draft);

  if (session.settings.enabledTools.includes("propose_scenario")) {
    const proposed = executeProposeScenario(filled, session);
    traces.push({
      toolId: "propose_scenario",
      input: filled,
      output: proposed,
    });
  } else {
    session.draft = filled;
  }

  if (
    wantsApply(last) &&
    session.settings.enabledTools.includes("apply_scenario") &&
    session.draft
  ) {
    const applied = executeApplyScenario({ confirm: true }, session);
    traces.push({
      toolId: "apply_scenario",
      input: { confirm: true },
      output: applied,
    });
  }

  const draft = session.draft ?? filled;
  return {
    text: assistantCopy(
      session.settings.language,
      draft,
      Boolean(session.appliedInput),
    ),
    traces,
  };
}
