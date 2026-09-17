import {
  generateId,
  generateText,
  isStepCount,
  tool,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { packAgentContext } from "./context";
import { runLocalAgentTurn } from "./local-fallback";
import { composeRuntimeSystemPrompt } from "./prompts";
import {
  readProviderAvailability,
  resolveAgentProvider,
  resolveAgentRuntime,
} from "./availability";
import { createAgentModel } from "./provider";
import {
  AGENT_TOOL_CATALOG,
  applyScenarioSchema,
  executeApplyScenario,
  executeListCatalog,
  executePatchDraft,
  executeProposeScenario,
  executeResetDraft,
  listCatalogSchema,
  patchDraftSchema,
  proposeScenarioSchema,
  resetDraftSchema,
} from "./tools";
import type {
  AgentChatMessage,
  AgentChatRequest,
  AgentChatResponse,
  AgentHarnessSettings,
  AgentResolvedProvider,
  AgentToolId,
  AgentToolSession,
  AgentToolTrace,
} from "./types";
import { isAgentToolId } from "./types";

export function createToolSession(
  request: Pick<AgentChatRequest, "settings" | "catalog" | "draft">,
): AgentToolSession {
  return {
    draft: request.draft,
    catalog: request.catalog,
    settings: request.settings,
    appliedInput: null,
  };
}

export function createAiSdkTools(
  session: AgentToolSession,
  enabledTools: AgentToolId[],
) {
  const enabled = new Set(enabledTools);
  const tools: ToolSet = {};

  for (const entry of AGENT_TOOL_CATALOG) {
    if (!enabled.has(entry.id)) continue;
    switch (entry.id) {
      case "list_catalog":
        tools.list_catalog = tool({
          description: entry.description,
          inputSchema: listCatalogSchema,
          execute: async () => executeListCatalog(session),
        });
        break;
      case "propose_scenario":
        tools.propose_scenario = tool({
          description: entry.description,
          inputSchema: proposeScenarioSchema,
          execute: async (input) => executeProposeScenario(input, session),
        });
        break;
      case "patch_draft":
        tools.patch_draft = tool({
          description: entry.description,
          inputSchema: patchDraftSchema,
          execute: async (input) => executePatchDraft(input, session),
        });
        break;
      case "apply_scenario":
        tools.apply_scenario = tool({
          description: entry.description,
          inputSchema: applyScenarioSchema,
          execute: async (input) => executeApplyScenario(input, session),
        });
        break;
      case "reset_draft":
        tools.reset_draft = tool({
          description: entry.description,
          inputSchema: resetDraftSchema,
          execute: async () => executeResetDraft(session),
        });
        break;
      default: {
        const _exhaustive: never = entry.id;
        throw new Error(`Herramienta no soportada: ${_exhaustive}`);
      }
    }
  }

  return tools;
}

function tracesFromToolResults(results: Array<{ toolName?: string; input?: unknown; output?: unknown }>): AgentToolTrace[] {
  const traces: AgentToolTrace[] = [];
  for (const result of results) {
    if (typeof result.toolName === "string" && isAgentToolId(result.toolName)) {
      traces.push({
        toolId: result.toolName,
        input: result.input,
        output: result.output,
      });
    }
  }
  return traces;
}

function toModelMessages(messages: AgentChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function buildHarnessContext(request: AgentChatRequest): {
  contextPack: string;
  systemPromptUsed: string;
} {
  const contextPack = packAgentContext({
    settings: request.settings,
    catalog: request.catalog,
    draft: request.draft,
  });
  return {
    contextPack,
    systemPromptUsed: composeRuntimeSystemPrompt(request.settings, contextPack),
  };
}

export async function runAiSdkTurn(input: {
  request: AgentChatRequest;
  session: AgentToolSession;
  model: LanguageModel;
  systemPromptUsed: string;
}): Promise<{ text: string; traces: AgentToolTrace[] }> {
  const tools = createAiSdkTools(input.session, input.request.settings.enabledTools);
  const result = await generateText({
    model: input.model,
    system: input.systemPromptUsed,
    messages: toModelMessages(input.request.messages),
    tools,
    temperature: input.request.settings.temperature,
    stopWhen: isStepCount(input.request.settings.maxSteps),
  });

  return {
    text: result.text.trim(),
    traces: tracesFromToolResults(result.toolResults),
  };
}

function finishResponse(input: {
  settings: AgentHarnessSettings;
  session: AgentToolSession;
  text: string;
  traces: AgentToolTrace[];
  runtime: "ai-sdk" | "local";
  provider: AgentResolvedProvider;
  systemPromptUsed: string;
  contextPack: string;
}): AgentChatResponse {
  const assistantText =
    input.text.trim() ||
    (input.settings.language === "en"
      ? "I updated the draft. Review it in Settings and save when ready."
      : "Actualicé el borrador. Revísalo en Ajustes y guárdalo cuando esté listo.");

  return {
    assistantMessage: {
      id: generateId(),
      role: "assistant",
      content: assistantText,
    },
    draft: input.session.draft,
    traces: input.traces,
    runtime: input.runtime,
    provider: input.provider,
    systemPromptUsed: input.systemPromptUsed,
    contextPack: input.contextPack,
    appliedInput: input.session.appliedInput,
  };
}

export class AgentHarnessError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AgentHarnessError";
    this.status = status;
  }
}

export async function runAgentChat(
  request: AgentChatRequest,
): Promise<AgentChatResponse> {
  const availability = readProviderAvailability();
  const runtime = resolveAgentRuntime(request.settings.runtime, availability);
  const provider = resolveAgentProvider(
    request.settings.providerPreference,
    availability,
  );
  const { contextPack, systemPromptUsed } = buildHarnessContext(request);
  const session = createToolSession(request);

  if (runtime === "local") {
    const local = runLocalAgentTurn({
      messages: request.messages,
      session,
    });
    return finishResponse({
      settings: request.settings,
      session,
      text: local.text,
      traces: local.traces,
      runtime: "local",
      provider: "local",
      systemPromptUsed,
      contextPack,
    });
  }

  const model = createAgentModel(provider);
  if (!model) {
    if (request.settings.runtime === "ai-sdk") {
      throw new AgentHarnessError(
        "El runtime AI SDK está forzado, pero faltan GROQ_API_KEY, GOOGLE_API_KEY o AI_GATEWAY_API_KEY.",
        503,
      );
    }
    const local = runLocalAgentTurn({
      messages: request.messages,
      session,
    });
    return finishResponse({
      settings: request.settings,
      session,
      text: local.text,
      traces: local.traces,
      runtime: "local",
      provider: "local",
      systemPromptUsed,
      contextPack,
    });
  }

  try {
    const generated = await runAiSdkTurn({
      request,
      session,
      model,
      systemPromptUsed,
    });
    return finishResponse({
      settings: request.settings,
      session,
      text: generated.text,
      traces: generated.traces,
      runtime: "ai-sdk",
      provider,
      systemPromptUsed,
      contextPack,
    });
  } catch (error) {
    if (request.settings.runtime === "ai-sdk") {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "El modelo no respondió.";
      throw new AgentHarnessError(message, 502);
    }
    const local = runLocalAgentTurn({
      messages: request.messages,
      session,
    });
    return finishResponse({
      settings: request.settings,
      session,
      text: local.text,
      traces: local.traces,
      runtime: "local",
      provider: "local",
      systemPromptUsed,
      contextPack,
    });
  }
}
