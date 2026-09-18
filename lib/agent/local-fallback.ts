import { validateAuthoringDraft } from "@/lib/scenarios/authoring";
import { buildDeterministicComparison } from "@/lib/teams/comparison";
import {
  memoryFindTest,
  memoryGetSnapshot,
  memoryListResults,
  memoryListTeams,
} from "@/lib/teams/memory";
import { resolveHarnessState } from "./states";
import {
  executeApplyScenario,
  executeListCatalog,
  executeProposeScenario,
  executeResetDraft,
} from "./tools";
import type {
  AgentChatMessage,
  AgentChatRequest,
  AgentChatResponse,
  AgentToolSession,
  AgentToolTrace,
} from "./types";

const INDUSTRY_HINTS: Array<{ pattern: RegExp; industry: string; product: string }> = [
  { pattern: /banco|banca|fintech/i, industry: "Banca", product: "Pauta digital y captación de cuentas" },
  { pattern: /gimnasio|gym|fitness/i, industry: "Fitness", product: "Membresías y retención" },
  { pattern: /farmacia/i, industry: "Retail de farmacias", product: "Tráfico a tienda" },
  { pattern: /inmobil|vivienda|caseta/i, industry: "Desarrollo inmobiliario", product: "Visitas a caseta" },
  { pattern: /auto|concesion|showroom/i, industry: "Automotriz", product: "Gente en piso" },
  { pattern: /seguro/i, industry: "Seguros", product: "Citas en sucursal" },
  { pattern: /saas|software/i, industry: "SaaS", product: "Demo con fecha" },
  { pattern: /hotel|hosped/i, industry: "Hotelería", product: "Reservas directas" },
];

function latestUserText(messages: AgentChatMessage[]): string {
  return [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
}

function extractName(text: string): string {
  const match = text.match(
    /(?:gerente|director[ae]?|jefa?|dueñ[oa])\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/i,
  );
  if (match?.[1]) return match[1];
  return "Cliente";
}

function extractTitle(text: string): string {
  const match = text.match(
    /(gerente|director[ae]?|jefa?|dueñ[oa]|coordinador[ae]?)(?:\s+de\s+[\wáéíóúñ]+)?/i,
  );
  return match?.[0] ?? "Gerente";
}

function extractProblem(text: string): string {
  const match = text.match(
    /(?:no quiere|no busca|odia|cuelga|duele|problema(?:\s+de)?)\s+(.{8,80})/i,
  );
  if (match?.[1]) return match[1].replace(/[.,].*$/, "").trim();
  return text.trim().slice(0, 120) || "No quiere cambiar de proveedor";
}

function looksLikeSave(text: string): boolean {
  return /\b(guarda|guárdalo|guardar|ya|listo|aplícalo|aplicar)\b/i.test(text);
}

function looksLikeReset(text: string): boolean {
  return /\b(reinicia|borra el borrador|empezar de cero)\b/i.test(text);
}

function looksLikeCompare(text: string): boolean {
  return /\b(compara|comparar|mismo examen|mismo test)\b/i.test(text);
}

function looksLikeTeams(text: string): boolean {
  return /\b(equipos?|members?|miembros)\b/i.test(text);
}

export async function runLocalAgentTurn(input: {
  request: AgentChatRequest;
  session: AgentToolSession;
  systemPromptUsed: string;
  contextPack: string;
  roles: AgentChatResponse["roles"];
}): Promise<AgentChatResponse> {
  const text = latestUserText(input.request.messages);
  const enabled = new Set(input.request.settings.enabledTools);
  const traces: AgentToolTrace[] = [];

  if (enabled.has("reset_draft") && looksLikeReset(text)) {
    const result = executeResetDraft(input.session);
    traces.push({ toolId: "reset_draft", ok: result.ok, summary: result.summary });
  }

  if (enabled.has("list_catalog") && /catálogo|catalogo|preset|prefilled/i.test(text)) {
    const result = executeListCatalog(input.session);
    traces.push({ toolId: "list_catalog", ok: result.ok, summary: result.summary });
  }

  if (enabled.has("list_teams") && looksLikeTeams(text)) {
    const teams = memoryListTeams();
    traces.push({
      toolId: "list_teams",
      ok: true,
      summary:
        teams.length === 0
          ? "No hay equipos todavía."
          : `${teams.length} equipo(s): ${teams.map((team) => team.name).join(", ")}`,
    });
  }

  if (
    enabled.has("compare_team_test") &&
    looksLikeCompare(text) &&
    input.session.teamId &&
    input.session.testId
  ) {
    try {
      const snapshot = memoryGetSnapshot(input.session.teamId);
      const test = memoryFindTest(input.session.testId);
      if (!test || test.teamId !== input.session.teamId) {
        throw new Error("Examen no encontrado en este equipo.");
      }
      const results = memoryListResults(input.session.testId);
      input.session.comparison = buildDeterministicComparison({
        teamName: snapshot.team.name,
        teamId: input.session.teamId,
        testId: input.session.testId,
        scenarioSlug: test.scenarioSlug,
        title: test.title,
        members: snapshot.members.map((member) => {
          const result = results.find((item) => item.memberId === member.id);
          return {
            memberId: member.id,
            displayName: member.displayName,
            totalScore: result?.totalScore ?? 0,
            won: result?.won ?? false,
            turnsCompleted: result?.turnsCompleted ?? 0,
          };
        }),
      });
      traces.push({
        toolId: "compare_team_test",
        ok: true,
        summary: input.session.comparison.narrative,
      });
    } catch (error) {
      traces.push({
        toolId: "compare_team_test",
        ok: false,
        summary: error instanceof Error ? error.message : "No se pudo comparar.",
      });
    }
  }

  if (enabled.has("propose_scenario") && text.trim()) {
    const hint = INDUSTRY_HINTS.find((item) => item.pattern.test(text));
    const proposed = executeProposeScenario(input.session, {
      clientName: extractName(text),
      clientTitle: extractTitle(text),
      companyContext: hint?.industry ?? "Empresa del comprador",
      industry: hint?.industry ?? "Comercial",
      productSold: hint?.product ?? "Solución comercial",
      clientProblem: extractProblem(text),
      objections:
        input.request.settings.presetId === "esceptico"
          ? ["Ya tengo proveedor", "No hay presupuesto", "Mándenme un mail"]
          : undefined,
      callType:
        input.request.settings.presetId === "cierre"
          ? "cierre"
          : input.request.settings.callType,
      language: input.request.settings.language,
    });
    traces.push({
      toolId: "propose_scenario",
      ok: proposed.ok,
      summary: proposed.summary,
    });
  }

  if (
    enabled.has("apply_scenario") &&
    looksLikeSave(text) &&
    input.session.draft &&
    !validateAuthoringDraft(input.session.draft)
  ) {
    const applied = executeApplyScenario(input.session, { confirm: true });
    traces.push({
      toolId: "apply_scenario",
      ok: applied.ok,
      summary: applied.summary,
    });
  }

  const draft = input.session.draft;
  const assistant =
    input.session.comparison?.narrative ??
    (draft
      ? `Borrador listo: ${draft.clientName}, ${draft.clientTitle} en ${draft.industry}. Dolor: ${draft.clientProblem}. Di «guárdalo» para confirmar.`
      : "Dime quién compra, qué se vende y qué le duele. Con una frase armo el caso.");

  return {
    assistantMessage: { role: "assistant", content: assistant },
    draft,
    traces,
    runtime: "local",
    provider: "local",
    state: resolveHarnessState({
      draft,
      applied: Boolean(input.session.appliedInput),
      comparing: Boolean(input.session.comparison),
      messageCount: input.request.messages.length,
    }),
    roles: input.roles,
    systemPromptUsed: input.systemPromptUsed,
    contextPack: input.contextPack,
    appliedInput: input.session.appliedInput,
    comparison: input.session.comparison,
  };
}
