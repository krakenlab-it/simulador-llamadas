import { generateText, isStepCount, tool } from "ai";
import { packAgentContext } from "./context";
import { runLocalAgentTurn } from "./local-fallback";
import { composeRuntimeSystemPrompt } from "./prompts";
import { createAgentModel } from "./provider";
import { resolveHarnessState } from "./states";
import {
  executeCompareTeamTest,
  executeListTeams,
} from "./team-tools";
import {
  applyScenarioSchema,
  compareTeamTestSchema,
  createToolSession,
  executeApplyScenario,
  executeListCatalog,
  executePatchDraft,
  executeProposeScenario,
  executeResetDraft,
  listCatalogSchema,
  listTeamsSchema,
  patchDraftSchema,
  proposeScenarioSchema,
  resetDraftSchema,
} from "./tools";
import {
  readProviderAvailability,
  resolveAgentRuntime,
} from "./availability";
import { parseAgentHarnessSettings } from "./settings";
import type {
  AgentChatMessage,
  AgentChatRequest,
  AgentChatResponse,
  AgentResolvedProvider,
  AgentToolId,
  AgentToolSession,
  AgentToolTrace,
  PublicScenarioSummary,
} from "./types";

export class AgentHarnessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentHarnessError";
    this.status = status;
  }
}

function toModelMessages(messages: AgentChatMessage[]): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  return messages
    .filter((item) => item.content.trim())
    .map((item) => ({ role: item.role, content: item.content }));
}

export function buildHarnessContext(request: AgentChatRequest): {
  systemPromptUsed: string;
  contextPack: string;
  roles: AgentChatResponse["roles"];
} {
  const contextPack = packAgentContext({
    settings: request.settings,
    catalog: request.catalog,
    draft: request.draft,
    teamHint:
      request.teamId || request.testId
        ? `teamId=${request.teamId ?? "—"} testId=${request.testId ?? "—"}`
        : null,
  });
  const composed = composeRuntimeSystemPrompt({
    settings: request.settings,
    contextPack,
  });
  return {
    systemPromptUsed: composed.systemPrompt,
    contextPack,
    roles: composed.roles,
  };
}

export function createAiSdkTools(session: AgentToolSession) {
  const enabled = new Set(session.settings.enabledTools);
  const tools: Record<string, unknown> = {};

  if (enabled.has("list_catalog")) {
    tools.list_catalog = tool({
      description: "Lista los escenarios del catálogo.",
      inputSchema: listCatalogSchema,
      execute: async () => executeListCatalog(session),
    });
  }
  if (enabled.has("propose_scenario")) {
    tools.propose_scenario = tool({
      description: "Propone un borrador completo de escenario.",
      inputSchema: proposeScenarioSchema,
      execute: async (input) => executeProposeScenario(session, input),
    });
  }
  if (enabled.has("patch_draft")) {
    tools.patch_draft = tool({
      description: "Ajusta campos del borrador actual.",
      inputSchema: patchDraftSchema,
      execute: async (input) => executePatchDraft(session, input),
    });
  }
  if (enabled.has("apply_scenario")) {
    tools.apply_scenario = tool({
      description: "Valida el borrador y lo deja listo para guardar.",
      inputSchema: applyScenarioSchema,
      execute: async (input) => executeApplyScenario(session, input),
    });
  }
  if (enabled.has("reset_draft")) {
    tools.reset_draft = tool({
      description: "Reinicia el borrador.",
      inputSchema: resetDraftSchema,
      execute: async () => executeResetDraft(session),
    });
  }
  if (enabled.has("list_teams")) {
    tools.list_teams = tool({
      description: "Lista equipos de práctica.",
      inputSchema: listTeamsSchema,
      execute: async () => executeListTeams(),
    });
  }
  if (enabled.has("compare_team_test")) {
    tools.compare_team_test = tool({
      description: "Compara miembros en el mismo examen.",
      inputSchema: compareTeamTestSchema,
      execute: async (input) => executeCompareTeamTest(session, input),
    });
  }

  return tools;
}

function tracesFromUnknown(results: unknown): AgentToolTrace[] {
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const toolId = String(record.toolName ?? record.tool ?? "");
    const output = record.output ?? record.result;
    const summary =
      output && typeof output === "object" && "summary" in output
        ? String((output as { summary: unknown }).summary)
        : toolId;
    const ok =
      output && typeof output === "object" && "ok" in output
        ? Boolean((output as { ok: unknown }).ok)
        : true;
    if (!toolId) return [];
    return [
      {
        toolId: toolId as AgentToolId,
        ok,
        summary,
      },
    ];
  });
}

function finishResponse(input: {
  session: AgentToolSession;
  request: AgentChatRequest;
  assistantText: string;
  traces: AgentToolTrace[];
  runtime: "ai-sdk" | "local";
  provider: AgentResolvedProvider;
  systemPromptUsed: string;
  contextPack: string;
  roles: AgentChatResponse["roles"];
}): AgentChatResponse {
  const assistantMessage: AgentChatMessage = {
    role: "assistant",
    content:
      input.assistantText.trim() ||
      (input.request.settings.language === "en"
        ? "I drafted a practice case. You can save it when it looks right."
        : "Armé un caso de práctica. Puedes guardarlo cuando te convenza."),
  };
  return {
    assistantMessage,
    draft: input.session.draft,
    traces: input.traces,
    runtime: input.runtime,
    provider: input.provider,
    state: resolveHarnessState({
      draft: input.session.draft,
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

export async function runAiSdkTurn(input: {
  request: AgentChatRequest;
  session: AgentToolSession;
  provider: AgentResolvedProvider;
  systemPromptUsed: string;
  contextPack: string;
  roles: AgentChatResponse["roles"];
}): Promise<AgentChatResponse> {
  const model = createAgentModel(input.provider);
  if (!model) {
    throw new AgentHarnessError(
      "No hay modelo AI SDK disponible. Configura DEEPSEEK_API_KEY (default) u otra clave documentada.",
      503,
    );
  }

  const tools = createAiSdkTools(input.session);
  const result = await generateText({
    model,
    system: input.systemPromptUsed,
    messages: toModelMessages(input.request.messages),
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    temperature: input.request.settings.temperature,
    stopWhen: isStepCount(input.request.settings.maxSteps),
  });

  return finishResponse({
    session: input.session,
    request: input.request,
    assistantText: result.text ?? "",
    traces: tracesFromUnknown(result.toolResults ?? result.steps),
    runtime: "ai-sdk",
    provider: input.provider,
    systemPromptUsed: input.systemPromptUsed,
    contextPack: input.contextPack,
    roles: input.roles,
  });
}

export async function runAgentChat(
  raw: unknown,
): Promise<AgentChatResponse> {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const messages = Array.isArray(body.messages)
    ? body.messages.filter((item): item is AgentChatMessage => {
        return (
          item &&
          typeof item === "object" &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        );
      })
    : [];
  if (messages.filter((item) => item.role === "user").length === 0) {
    throw new AgentHarnessError("Escribe un mensaje para el agente.", 400);
  }

  const catalog = Array.isArray(body.catalog)
    ? (body.catalog as PublicScenarioSummary[])
    : [];
  const settings = parseAgentHarnessSettings(body.settings);
  const request: AgentChatRequest = {
    messages,
    settings,
    catalog,
    draft:
      body.draft && typeof body.draft === "object"
        ? (body.draft as AgentChatRequest["draft"])
        : null,
    teamId: typeof body.teamId === "string" ? body.teamId : null,
    testId: typeof body.testId === "string" ? body.testId : null,
  };

  const availability = readProviderAvailability();
  const resolved = resolveAgentRuntime(
    settings.runtime,
    availability,
    settings.providerPreference,
  );
  const packed = buildHarnessContext(request);
  const session = createToolSession({
    draft: request.draft,
    catalog: request.catalog,
    settings,
    teamId: request.teamId ?? null,
    testId: request.testId ?? null,
  });

  if (settings.runtime === "ai-sdk" && resolved.provider === "local") {
    throw new AgentHarnessError(
      "Runtime AI SDK forzado, pero no hay DEEPSEEK_API_KEY / GROQ_API_KEY / GOOGLE_API_KEY / AI_GATEWAY_API_KEY.",
      503,
    );
  }

  if (resolved.runtime === "local") {
    return runLocalAgentTurn({
      request,
      session,
      systemPromptUsed: packed.systemPromptUsed,
      contextPack: packed.contextPack,
      roles: packed.roles,
    });
  }

  try {
    return await runAiSdkTurn({
      request,
      session,
      provider: resolved.provider,
      systemPromptUsed: packed.systemPromptUsed,
      contextPack: packed.contextPack,
      roles: packed.roles,
    });
  } catch (error) {
    if (error instanceof AgentHarnessError) throw error;
    if (settings.runtime === "ai-sdk") {
      throw new AgentHarnessError(
        "El modelo AI SDK falló. Revisa la clave o usa runtime Auto.",
        502,
      );
    }
    return runLocalAgentTurn({
      request,
      session,
      systemPromptUsed: packed.systemPromptUsed,
      contextPack: packed.contextPack,
      roles: packed.roles,
    });
  }
}
